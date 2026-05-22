import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from './device-token.entity.js';
import { NotificationSettings } from './notification-settings.entity.js';
import { PushLog } from './push-log.entity.js';
import { User } from '../users/user.entity.js';
import { RegisterTokenDto } from './dto/register-token.dto.js';
import { UpdateNotificationSettingsDto } from './dto/update-settings.dto.js';
import { getZonedParts, zonedWallToUtc } from '../../common/timezone.util.js';

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
  ) {}

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
  }

  async registerToken(userId: string, dto: RegisterTokenDto) {
    // Upsert: if same token exists for this user, update it
    const existing = await this.deviceTokenRepo.findOne({
      where: { userId, token: dto.token },
    });

    if (existing) {
      existing.isActive = true;
      existing.platform = dto.platform ?? existing.platform;
      return this.deviceTokenRepo.save(existing);
    }

    // Deactivate old tokens with same token (user switched accounts)
    await this.deviceTokenRepo.update(
      { token: dto.token },
      { isActive: false },
    );

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
    await this.deviceTokenRepo.update(
      { userId, token },
      { isActive: false },
    );
    return { success: true };
  }

  async getSettings(userId: string) {
    return this.ensureSettings(userId);
  }

  async updateSettings(userId: string, dto: UpdateNotificationSettingsDto) {
    let settings = await this.ensureSettings(userId);

    // Reject a free user trying to pick a premium-only frequency.
    // The client gates this in the UI too, but the API enforces it
    // server-side so a hand-rolled request can't bypass.
    if (dto.frequencyMinutes != null) {
      const user = await this.usersRepo.findOne({ where: { id: userId } });
      const isPremium = user?.subscriptionTier === 'premium';
      if (!isPremium && !FREE_FREQUENCY_MINUTES.includes(dto.frequencyMinutes)) {
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

  private async ensureSettings(
    userId: string,
  ): Promise<NotificationSettings> {
    let settings = await this.settingsRepo.findOne({ where: { userId } });

    if (!settings) {
      settings = this.settingsRepo.create({
        userId,
        isEnabled: true,
        // 3 hours = the most frequent free-tier interval. New users
        // land here by default — premium upgraders can dial it down.
        frequencyMinutes: 180,
        activeStartTime: '09:00',
        activeEndTime: '22:00',
        timezone: 'Asia/Seoul',
        quizPushRatio: 0.3,
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
