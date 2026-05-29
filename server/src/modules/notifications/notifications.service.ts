import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { DeviceToken } from './device-token.entity.js';
import { NotificationSettings } from './notification-settings.entity.js';
import { PushLog } from './push-log.entity.js';
import { User } from '../users/user.entity.js';
import { RegisterTokenDto } from './dto/register-token.dto.js';
import { UpdateNotificationSettingsDto } from './dto/update-settings.dto.js';
import { FcmService } from './fcm.service.js';
import {
  getZonedParts,
  isValidTimeZone,
  zonedWallToUtc,
} from '../../common/timezone.util.js';

/**
 * Push intervals available on the free plan. Anything not in this
 * list is premium-only — keeping the most frequent (and therefore
 * most learning-effective) cadences behind the paywall is the
 * primary upsell hook of the free tier.
 *
 * Mirrored on the client (notification_settings_screen.dart).
 */
export const FREE_FREQUENCY_MINUTES = [180, 240, 360];
/** Minimum interval a free user can effectively receive — even if a
 *  stored value (legacy / downgrade) is smaller, the scheduler
 *  clamps to this. */
const FREE_MIN_INTERVAL = 180;

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    @InjectRepository(DeviceToken)
    private deviceTokenRepo: Repository<DeviceToken>,
    @InjectRepository(NotificationSettings)
    private settingsRepo: Repository<NotificationSettings>,
    @InjectRepository(PushLog)
    private pushLogRepo: Repository<PushLog>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private fcmService: FcmService,
  ) {}

  /**
   * 운영 이벤트 (신규 문의/결제/환불/취소) 발생 시 isAdmin=true인
   * 모든 user의 활성 device token에 알림 발송. 일반 LingoLoop 앱
   * 으로 로그인한 admin user는 평소 사용 패턴 그대로이고 추가
   * 알림만 받음 — 별도 admin 앱 없음.
   *
   * 실패는 silent (운영 이벤트 자체 흐름을 막지 않음). 무효 token
   * 발견 시 isActive=false로 자동 회수.
   *
   * payload.data.adminEventType 으로 클라이언트가 추후 분기 라우팅
   * 가능 (예: 'inquiry' → /inquiries, 'subscription' → /backstage 등).
   */
  async notifyAdmins(payload: {
    title: string;
    body: string;
    eventType:
      | 'inquiry'
      | 'purchase'
      | 'refund'
      | 'cancel'
      | 'renew'
      | 'resume'
      | 'fail'
      | 'admin_grant'
      | 'admin_revoke';
    extra?: Record<string, string>;
  }): Promise<void> {
    const logger = new Logger('notifyAdmins');
    try {
      // 글로벌 토글 확인 (ll_app_config.adminPushPrefs[eventType]).
      // 키 누락 = 기본 true. false 명시 시만 skip.
      // 임시: appConfigRepo가 NotificationsService에 없어서 raw query.
      const cfgRows = await this.usersRepo.query(
        `SELECT "adminPushPrefs" AS prefs FROM ll_app_config LIMIT 1`,
      );
      const prefs: Record<string, boolean> = cfgRows?.[0]?.prefs ?? {};
      if (prefs[payload.eventType] === false) {
        logger.log(`${payload.eventType} → globally disabled, skip`);
        return;
      }

      const admins = await this.usersRepo.find({
        where: { isAdmin: true, isActive: true, deletedAt: IsNull() },
        select: ['id'],
      });
      if (admins.length === 0) {
        logger.warn(`no admin users · ${payload.eventType}: ${payload.title}`);
        return;
      }

      const tokens = await this.deviceTokenRepo.find({
        where: {
          isActive: true,
          userId: In(admins.map((a) => a.id)),
        },
      });
      if (tokens.length === 0) {
        logger.warn(
          `${admins.length} admin(s) but no active tokens · ${payload.eventType}: ${payload.title}`,
        );
        return;
      }

      const data: Record<string, string> = {
        type: 'admin_event',
        adminEventType: payload.eventType,
        ...(payload.extra ?? {}),
      };
      let success = 0;
      // 같은 사용자가 여러 디바이스를 가질 수 있으므로 userId 단위로
      // pushLog 한 번씩만 (디바이스 단위 발송 결과는 success count로).
      const tokensByUser = new Map<string, typeof tokens>();
      for (const t of tokens) {
        const arr = tokensByUser.get(t.userId) ?? [];
        arr.push(t);
        tokensByUser.set(t.userId, arr);
      }

      for (const [userId, userTokens] of tokensByUser.entries()) {
        let userSuccess = 0;
        for (const t of userTokens) {
          const ok = await this.fcmService.sendToDevice(t.token, {
            title: payload.title,
            body: payload.body,
            data,
            // admin 알림은 inquiry_reply와 다른 그룹 — 클라가 같은
            // tag/thread로 cancel하지 않게 분리.
            androidTag: `admin_${payload.eventType}`,
            iosThreadId: `admin_${payload.eventType}`,
          });
          if (ok) {
            userSuccess++;
            success++;
          } else {
            await this.deviceTokenRepo.update(
              { id: t.id },
              { isActive: false },
            );
          }
        }
        // pushLog는 유저당 한 row. 한 디바이스라도 성공이면 'sent',
        // 전부 실패면 'failed'.
        await this.pushLogRepo
          .save({
            userId,
            pushType: `admin_${payload.eventType}`,
            title: payload.title,
            body: payload.body,
            status: userSuccess > 0 ? 'sent' : 'failed',
          })
          .catch((e) => {
            logger.error(`pushLog save failed: ${e?.message}`);
          });
      }
      logger.log(
        `${payload.eventType} → admins=${admins.length} tokens=${tokens.length} success=${success} (${payload.title})`,
      );
    } catch (e: any) {
      // 알림 실패가 원본 이벤트 처리(문의 저장, 결제 검증 등)를
      // 방해하면 안 됨. silent fail이지만 로그는 남김.
      logger.error(`notifyAdmins error: ${e?.message}`);
    }
  }

  /**
   * nextPushAt must be an absolute instant. A bare `timestamp` column is
   * interpreted in the server process timezone, which shifts the value if
   * the container isn't UTC. Convert it to `timestamptz` once (treating
   * existing naive values as UTC). Guarded so it only runs when needed.
   */
  async onModuleInit() {
    const rows = await this.settingsRepo.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'll_notification_settings'
         AND column_name = 'nextPushAt'`,
    );
    const type = rows?.[0]?.data_type;
    if (type && type === 'timestamp without time zone') {
      await this.settingsRepo.query(
        `ALTER TABLE ll_notification_settings
         ALTER COLUMN "nextPushAt" TYPE timestamptz
         USING "nextPushAt" AT TIME ZONE 'UTC'`,
      );
    }

    // quizPushRatio → wordPushRatio rename (퀴즈 푸시를 단어 푸시로 교체).
    // 두 컬럼이 동시에 존재할 일은 없지만, 기존 quizPushRatio만 있을
    // 때만 rename. 이미 wordPushRatio로 마이그레이션 끝났으면 no-op.
    const cols = await this.settingsRepo.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'll_notification_settings'
         AND column_name IN ('quizPushRatio','wordPushRatio')`,
    );
    // ll_push_logs에 title/body 컬럼 추가 (idempotent). 운영자 push
    // history에 실제 내용을 노출하기 위해.
    await this.pushLogRepo.query(
      `ALTER TABLE ll_push_logs
       ADD COLUMN IF NOT EXISTS "title" text,
       ADD COLUMN IF NOT EXISTS "body" text;`,
    );

    const names = new Set<string>(cols.map((r: any) => r.column_name));
    if (names.has('quizPushRatio') && !names.has('wordPushRatio')) {
      await this.settingsRepo.query(
        `ALTER TABLE ll_notification_settings RENAME COLUMN "quizPushRatio" TO "wordPushRatio"`,
      );
    }
  }

  async registerToken(userId: string, dto: RegisterTokenDto) {
    // 한 디바이스 = 하나의 active 토큰만. FCM 토큰은 디바이스 식별자라
    // 같은 토큰이 여러 유저에 active로 남으면 한 이벤트당 푸시가 N번.
    // 다른 user의 동일 토큰 row는 모두 비활성화 — current user는
    // 아래서 active로 (재)등록.
    await this.deviceTokenRepo.update(
      { token: dto.token, isActive: true },
      { isActive: false },
    );

    // 본인의 동일 토큰 row가 있으면 reactivate, 없으면 신규 생성.
    const existing = await this.deviceTokenRepo.findOne({
      where: { userId, token: dto.token },
    });

    if (existing) {
      existing.isActive = true;
      existing.platform = dto.platform ?? existing.platform;
      return this.deviceTokenRepo.save(existing);
    }

    const deviceToken = this.deviceTokenRepo.create({
      userId,
      token: dto.token,
      platform: dto.platform ?? 'unknown',
    });

    // Ensure notification settings exist with initial nextPushAt
    await this.ensureSettings(userId);

    return this.deviceTokenRepo.save(deviceToken);
  }

  async removeToken(userId: string, token: string) {
    await this.deviceTokenRepo.update({ userId, token }, { isActive: false });
    return { success: true };
  }

  async getSettings(userId: string) {
    const settings = await this.ensureSettings(userId);
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (
      user?.subscriptionTier !== 'premium' &&
      this.hasPremiumOnlySettings(settings)
    ) {
      return this.downgradeSettingsForFreePlan(userId);
    }
    return settings;
  }

  async updateSettings(userId: string, dto: UpdateNotificationSettingsDto) {
    const settings = await this.ensureSettings(userId);
    if (dto.timezone != null && !isValidTimeZone(dto.timezone.trim())) {
      throw new BadRequestException('Invalid timezone');
    }
    if (dto.timezone != null) {
      dto.timezone = dto.timezone.trim();
    }

    // Reject a free user trying to pick a premium-only frequency.
    // The client gates this in the UI too, but the API enforces it
    // server-side so a hand-rolled request can't bypass.
    if (dto.frequencyMinutes != null) {
      const user = await this.usersRepo.findOne({ where: { id: userId } });
      const isPremium = user?.subscriptionTier === 'premium';
      if (
        !isPremium &&
        !FREE_FREQUENCY_MINUTES.includes(dto.frequencyMinutes)
      ) {
        throw new ForbiddenException(
          '선택한 알림 주기는 프리미엄 전용이에요. 무료 플랜은 3시간 · 4시간 · 6시간 주기 중에서 골라주세요.',
        );
      }
    }

    Object.assign(settings, dto);

    // If disabled, clear nextPushAt
    if (!settings.isEnabled) {
      settings.nextPushAt = null as any;
    } else {
      settings.nextPushAt = this.calculateNextPushAt(settings, new Date());
    }

    return this.settingsRepo.save(settings);
  }

  /**
   * Effective interval for a given user, factoring in plan + the
   * stored choice. Used by the push scheduler so that a user who
   * downgrades from premium to free (or had a legacy small
   * interval) stops getting frequent pushes immediately, even if
   * they never re-opened the settings screen to change it.
   */
  effectiveFrequencyMinutes(
    settings: NotificationSettings,
    user: User | null,
  ): number {
    const isPremium = user?.subscriptionTier === 'premium';
    if (isPremium) return settings.frequencyMinutes;
    return Math.max(settings.frequencyMinutes, FREE_MIN_INTERVAL);
  }

  /**
   * Called when a premium subscription expires/cancels/refunds. It
   * rewrites stored premium-only notification settings into an
   * explicitly free-plan-safe state, rather than merely relying on
   * the scheduler clamp. This prevents a just-expired user from
   * receiving one more already-scheduled 60-minute push.
   */
  async downgradeSettingsForFreePlan(userId: string) {
    const settings = await this.settingsRepo.findOne({ where: { userId } });
    if (!settings) return this.ensureSettings(userId);

    if (!FREE_FREQUENCY_MINUTES.includes(settings.frequencyMinutes)) {
      settings.frequencyMinutes = FREE_MIN_INTERVAL;
    }
    // Free users never get word pushes. Keep the setting explicit so
    // the client doesn't display stale premium ratios after downgrade.
    settings.wordPushRatio = 0;
    settings.nextPushAt = settings.isEnabled
      ? this.calculateNextPushAt(settings, new Date(), FREE_MIN_INTERVAL)
      : (null as any);

    return this.settingsRepo.save(settings);
  }

  private hasPremiumOnlySettings(settings: NotificationSettings): boolean {
    return (
      !FREE_FREQUENCY_MINUTES.includes(settings.frequencyMinutes) ||
      settings.wordPushRatio > 0
    );
  }

  async getPushLogs(userId: string, limit = 20) {
    return this.pushLogRepo.find({
      where: { userId },
      order: { sentAt: 'DESC' },
      take: limit,
    });
  }

  async logPushTap(userId: string, pushLogId: number) {
    await this.pushLogRepo.update(
      { id: pushLogId, userId },
      { tappedAt: new Date() },
    );
    return { success: true };
  }

  private async ensureSettings(userId: string): Promise<NotificationSettings> {
    let settings = await this.settingsRepo.findOne({ where: { userId } });

    if (!settings) {
      const user = await this.usersRepo.findOne({ where: { id: userId } });
      settings = this.settingsRepo.create({
        userId,
        isEnabled: true,
        // 3 hours = the most frequent free-tier interval. New users
        // land here by default — premium upgraders can dial it down.
        frequencyMinutes: 180,
        activeStartTime: '09:00',
        activeEndTime: '22:00',
        timezone: user?.timezone || 'Asia/Seoul',
        wordPushRatio: 0.3,
      });
      settings.nextPushAt = this.calculateNextPushAt(settings, new Date());
      settings = await this.settingsRepo.save(settings);
    }

    return settings;
  }

  /**
   * Returns the next push time as a correct absolute UTC instant, honoring
   * the user's IANA timezone and active window. Server is UTC; all math is
   * done against the user's wall clock via Intl, then converted back.
   *
   * `intervalMinutes` lets the scheduler pass an already-clamped value
   * (for a free user whose stored frequency would otherwise drop below
   * the free-tier floor); when omitted, falls back to the stored value.
   */
  calculateNextPushAt(
    settings: NotificationSettings,
    from: Date,
    intervalMinutes?: number,
  ): Date {
    const tz = settings.timezone || 'Asia/Seoul';
    const interval = intervalMinutes ?? settings.frequencyMinutes;
    const candidate = new Date(from.getTime() + interval * 60000);
    const z = getZonedParts(candidate, tz);

    const [startH, startM] = settings.activeStartTime.split(':').map(Number);
    const [endH, endM] = settings.activeEndTime.split(':').map(Number);
    const currentMinutes = z.hour * 60 + z.minute;
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Within the active window → push at the candidate instant.
    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      return candidate;
    }

    // Before the window opens today → push at today's start.
    if (currentMinutes < startMinutes) {
      return zonedWallToUtc(z.year, z.month, z.day, startH, startM, tz);
    }

    // After the window closed → push at the next day's start.
    const nextDay = getZonedParts(
      new Date(candidate.getTime() + 24 * 60 * 60000),
      tz,
    );
    return zonedWallToUtc(
      nextDay.year,
      nextDay.month,
      nextDay.day,
      startH,
      startM,
      tz,
    );
  }
}
