import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { NotificationSettings } from './notification-settings.entity.js';
import { DeviceToken } from './device-token.entity.js';
import { PushLog } from './push-log.entity.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { User } from '../users/user.entity.js';
import { Vocabulary } from '../vocabulary/vocabulary.entity.js';
import { FcmService } from './fcm.service.js';
import { NotificationsService } from './notifications.service.js';
import { isPremiumEnabled } from '../../config/feature-flags.js';
import { getZonedParts, zonedDateString } from '../../common/timezone.util.js';

@Injectable()
export class PushSchedulerService {
  private readonly logger = new Logger(PushSchedulerService.name);

  constructor(
    @InjectRepository(NotificationSettings)
    private settingsRepo: Repository<NotificationSettings>,
    @InjectRepository(DeviceToken)
    private deviceTokenRepo: Repository<DeviceToken>,
    @InjectRepository(PushLog)
    private pushLogRepo: Repository<PushLog>,
    @InjectRepository(DailyAssignment)
    private assignmentRepo: Repository<DailyAssignment>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Vocabulary)
    private vocabularyRepo: Repository<Vocabulary>,
    private fcmService: FcmService,
    private notificationsService: NotificationsService,
  ) {}

  // Run every minute
  @Cron('* * * * *')
  async handlePushCron() {
    const now = new Date();

    // Find users whose next_push_at <= now and notifications are enabled
    const dueSettings = await this.settingsRepo.find({
      where: {
        isEnabled: true,
        nextPushAt: LessThanOrEqual(now),
      },
    });

    if (dueSettings.length === 0) return;

    this.logger.debug(`Processing ${dueSettings.length} due push(es)`);

    for (const settings of dueSettings) {
      try {
        await this.processPush(settings, now);
      } catch (error: any) {
        this.logger.error(
          `Push failed for user ${settings.userId}: ${error.message}`,
        );
        // nextPushAt 진행 안 하면 1분 후 cron이 같은 row 다시 시도.
        // 영구 에러(stale data, malformed sentence 등)면 매 분 무한
        // 반복으로 cron 슬롯 낭비 + DB 노이즈. owner를 다시 조회해
        // tier-aware interval로 advance.
        try {
          const owner = await this.usersRepo.findOne({
            where: { id: settings.userId },
          });
          this.updateNextPushAt(settings, now, owner);
          await this.settingsRepo.save(settings);
        } catch (advanceErr: any) {
          // settings save조차 실패하면 (e.g. DB down) 다음 cron에
          // 자연 재시도. 별도 처리 없음.
          this.logger.error(
            `Failed to advance nextPushAt for ${settings.userId}: ${advanceErr.message}`,
          );
        }
      }
    }
  }

  private async processPush(settings: NotificationSettings, now: Date) {
    // Load the user up front so every scheduling decision (active-
    // hours skip, no-device skip, normal send) routes through the
    // plan-aware interval clamp. Without this a free user's stored
    // 60min frequency would keep firing every hour even though the
    // free-tier floor is 180.
    const owner = await this.usersRepo.findOne({
      where: { id: settings.userId },
    });

    // Check if within active hours (user's timezone)
    if (!this.isWithinActiveHours(settings, now)) {
      // Skip but still advance nextPushAt to next active window
      await this.advanceToNextActiveWindow(settings, now, owner);
      return;
    }

    // Get user's device tokens
    const deviceTokens = await this.deviceTokenRepo.find({
      where: { userId: settings.userId, isActive: true },
    });

    if (deviceTokens.length === 0) {
      // No devices — still advance schedule
      this.updateNextPushAt(settings, now, owner);
      await this.settingsRepo.save(settings);
      return;
    }

    // Decide: sentence push or word push. Word is a premium feature —
    // gated on BOTH the global paid-plan flag AND this specific
    // user's subscription tier. Without the per-user check, a free
    // user would still receive word pushes once PREMIUM_ENABLED is
    // flipped on globally for paid users.
    const isUserPremium =
      !!owner &&
      !owner.deletedAt &&
      owner.isActive &&
      owner.subscriptionTier === 'premium';
    const tryWordPush =
      isPremiumEnabled() &&
      isUserPremium &&
      Math.random() < settings.wordPushRatio;
    let pushPayload: {
      title: string;
      body: string;
      data: Record<string, string>;
      contentId?: number;
    } | null = null;
    let pushType: 'word' | 'sentence' = 'sentence';

    // 단어 푸시 시도 — 단어장이 비어있거나 뜻이 없는 경우엔 fall-through
    // 해서 문장 푸시 보냄. 빈 결과로 무의미한 푸시를 보내지 않으려고.
    if (tryWordPush) {
      // ORDER BY random() LIMIT 1 — 작은 단어장에선 충분히 빠름.
      // 큰 단어장(>5k)으로 커지면 offset 샘플링으로 교체 고려.
      const vocab = await this.vocabularyRepo
        .createQueryBuilder('v')
        .where('v.userId = :userId', { userId: settings.userId })
        .andWhere('v.meaning IS NOT NULL')
        .andWhere("v.meaning <> ''")
        .orderBy('RANDOM()')
        .limit(1)
        .getOne();

      if (vocab) {
        pushType = 'word';
        pushPayload = {
          title: vocab.word,
          body: vocab.meaning ?? '',
          data: {
            type: 'word',
            vocabId: String(vocab.id),
            action: 'vocabulary',
          },
          contentId: vocab.id,
        };
      }
    }

    if (pushType === 'sentence') {
      // Get today's sentence for this user.
      //
      // 가장 최근 active assignment만 — 사용자가 skip하면 옛 assignment
      // 는 status='skipped'로 남고 새 active가 생김. status 필터 +
      // order id DESC 없이 findOne 했던 이전 코드는 PG의 임의 순서로
      // 옛 skipped를 골라 푸시해 "방금 넘긴 문장이 또 옴" 버그.
      const today = zonedDateString(
        now,
        settings.timezone || owner?.timezone || 'Asia/Seoul',
      );
      const assignment = await this.assignmentRepo.findOne({
        where: {
          userId: settings.userId,
          assignedDate: today,
          status: 'active',
        },
        relations: ['sentence'],
        order: { id: 'DESC' },
      });

      if (assignment) {
        // 문장 길이에 따라 분기 — 짧으면(≤16자) title에 영어, body에
        // 뜻으로 잠금화면에서 즉시 두 줄 노출. 길면 title이 OS에서
        // 잘려서 핵심이 안 보이므로 라벨을 title로, body에 영어+뜻
        // 둘 다 넣어 long-press expand에서 전체 확인 가능.
        const sentenceText = assignment.sentence.text;
        const translation = assignment.sentence.translation ?? '';
        const isShort = sentenceText.length <= 16;
        pushPayload = {
          title: isShort ? sentenceText : '📖 오늘의 문장',
          body: isShort
              ? translation
              : `${sentenceText}\n${translation}`,
          data: {
            type: 'sentence',
            sentenceId: String(assignment.sentenceId),
            action: 'today',
          },
          contentId: assignment.sentenceId,
        };
      } else {
        pushPayload = {
          title: '📖 LingoLoop',
          body: '오늘의 문장을 확인해보세요!',
          data: { type: 'sentence', action: 'today' },
        };
      }
    }

    if (!pushPayload) {
      throw new Error(
        `Failed to build push payload for user ${settings.userId}`,
      );
    }

    const pushLog = await this.pushLogRepo.save({
      userId: settings.userId,
      pushType,
      contentId: pushPayload.contentId,
      status: 'pending',
    });
    pushPayload.data.pushLogId = String(pushLog.id);

    // Send push to all devices. FCM 호출이 throw하면 pushLog가 'pending'
    // 상태로 영원히 남는 걸 방지하려 try/finally로 finalize 강제.
    // status는 result 분기, 또는 throw 시 'failed'로 마감.
    const tokens = deviceTokens.map((dt) => dt.token);
    try {
      const result = await this.fcmService.sendToMultiple(tokens, pushPayload);

      // Deactivate invalid tokens
      if (result.invalidTokens.length > 0) {
        await this.deviceTokenRepo
          .createQueryBuilder()
          .update()
          .set({ isActive: false })
          .where('token IN (:...tokens)', { tokens: result.invalidTokens })
          .execute();
      }

      pushLog.status = result.success > 0 ? 'sent' : 'failed';
      await this.pushLogRepo.save(pushLog);

      this.logger.debug(
        `Push sent to user ${settings.userId}: ${result.success} success, ${result.failure} failed`,
      );
    } catch (sendErr) {
      // sendToMultiple 자체가 throw하면 (정상 path에선 catch해 result
      // 반환하지만 SDK 초기화 실패 등 예외 케이스) pushLog를 명시적
      // 으로 'failed' 마감. 그 다음 outer catch가 nextPushAt 진행을
      // 책임지도록 rethrow.
      pushLog.status = 'failed';
      await this.pushLogRepo.save(pushLog).catch(() => {});
      throw sendErr;
    }

    // Update next push time (정상 path만 도달).
    this.updateNextPushAt(settings, now, owner);
    await this.settingsRepo.save(settings);
  }

  private isWithinActiveHours(
    settings: NotificationSettings,
    now: Date,
  ): boolean {
    // Wall-clock time in the user's timezone (server runs in UTC).
    const z = getZonedParts(now, settings.timezone || 'Asia/Seoul');
    const currentMinutes = z.hour * 60 + z.minute;

    const [startH, startM] = settings.activeStartTime.split(':').map(Number);
    const [endH, endM] = settings.activeEndTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  private updateNextPushAt(
    settings: NotificationSettings,
    now: Date,
    owner: User | null,
  ) {
    settings.nextPushAt = this.notificationsService.calculateNextPushAt(
      settings,
      now,
      this.notificationsService.effectiveFrequencyMinutes(settings, owner),
    );
  }

  private async advanceToNextActiveWindow(
    settings: NotificationSettings,
    now: Date,
    owner: User | null,
  ) {
    settings.nextPushAt = this.notificationsService.calculateNextPushAt(
      settings,
      now,
      this.notificationsService.effectiveFrequencyMinutes(settings, owner),
    );
    await this.settingsRepo.save(settings);
  }
}
