import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DeviceToken } from './device-token.entity.js';
import { User } from '../users/user.entity.js';
import { FcmService } from './fcm.service.js';
import { SentencesService } from '../sentences/sentences.service.js';

/**
 * Daily silent push that wakes the client at midnight so the home screen
 * widget can render the new day's sentence without waiting for the user
 * to open the app. The launch market is Korea, so we run on the
 * `Asia/Seoul` timezone — when we onboard other regions this can be
 * sharded by user.timezone.
 */
@Injectable()
export class WidgetRefreshService {
  private readonly logger = new Logger(WidgetRefreshService.name);

  constructor(
    @InjectRepository(DeviceToken)
    private deviceTokenRepo: Repository<DeviceToken>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private fcmService: FcmService,
    private sentencesService: SentencesService,
  ) {}

  // 00:01 every day in Asia/Seoul (gives the DB clock a one-minute margin
  // before we ask getToday() to compute "today's" date).
  @Cron('1 0 * * *', { timeZone: 'Asia/Seoul' })
  async handleKstMidnightRefresh() {
    await this.refreshAll('Asia/Seoul');
  }

  /**
   * Sends a silent FCM push with today's sentence to every device whose
   * owner falls in the requested timezone. Exposed (non-private) so it
   * can be called from an admin endpoint for manual fan-out.
   */
  /** Concurrent users processed per batch — keeps DB / FCM in check. */
  private readonly batchSize = 20;

  async refreshAll(timezone: string): Promise<{ users: number; pushes: number }> {
    const tokens = await this.deviceTokenRepo.find({ where: { isActive: true } });
    if (tokens.length === 0) {
      return { users: 0, pushes: 0 };
    }

    // Group active tokens by user.
    const byUser = new Map<string, string[]>();
    for (const t of tokens) {
      const arr = byUser.get(t.userId) ?? [];
      arr.push(t.token);
      byUser.set(t.userId, arr);
    }

    const userIds = Array.from(byUser.keys());
    const allUsers = userIds.length === 0
      ? []
      : await this.userRepo.findBy({ id: In(userIds) });

    // Filter to the requested timezone up front so we don't waste a
    // batch slot on a user we'll just skip.
    const targetUsers = allUsers.filter(
      (u) => (u.timezone || 'Asia/Seoul') === timezone,
    );

    let pushes = 0;
    let reached = 0;
    // Run users in fixed-size concurrent batches. The earlier serial
    // loop was O(N) round-trips and stretched to minutes for large
    // user counts; 20-at-a-time keeps DB + FCM healthy without
    // overwhelming either.
    for (let i = 0; i < targetUsers.length; i += this.batchSize) {
      const batch = targetUsers.slice(i, i + this.batchSize);
      const results = await Promise.all(
        batch.map((user) => this.refreshOne(user, byUser.get(user.id) ?? [])),
      );
      for (const r of results) {
        if (!r) continue;
        pushes += r.pushes;
        if (r.delivered) reached += 1;
      }
    }

    this.logger.log(
      `Widget refresh for ${timezone}: ${reached} users, ${pushes} pushes`,
    );
    return { users: reached, pushes };
  }

  private async refreshOne(
    user: User,
    userTokens: string[],
  ): Promise<{ delivered: boolean; pushes: number } | null> {
    if (userTokens.length === 0) return null;
    try {
      const today = await this.sentencesService.getToday(
        user.id,
        user.targetLanguage || 'en',
        user.timezone || 'Asia/Seoul',
        user.learningTrack ?? undefined,
      );

      const wordsJson = JSON.stringify(
        ((today.sentence as any).words ?? [])
          .slice(0, 6)
          .map((w: any) => ({ w: w.word ?? '', m: w.meaning ?? '' })),
      );
      const data: Record<string, string> = {
        type: 'widget_refresh',
        today_text: today.sentence.text ?? '',
        today_translation: today.sentence.translation ?? '',
        today_pronunciation: today.sentence.pronunciation ?? '',
        today_situation: today.sentence.situation ?? '',
        today_date: today.assignedDate ?? '',
        today_words: wordsJson,
      };

      const result = await this.fcmService.sendSilentToMultiple(
        userTokens,
        data,
      );

      if (result.invalidTokens.length > 0) {
        await this.deviceTokenRepo
          .createQueryBuilder()
          .update()
          .set({ isActive: false })
          .where('token IN (:...tokens)', { tokens: result.invalidTokens })
          .execute();
      }

      return { delivered: true, pushes: result.success };
    } catch (e: any) {
      this.logger.error(
        `Widget refresh failed for user ${user.id}: ${e.message}`,
      );
      return { delivered: false, pushes: 0 };
    }
  }
}
