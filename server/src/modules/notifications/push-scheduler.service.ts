import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { NotificationSettings } from './notification-settings.entity.js';
import { DeviceToken } from './device-token.entity.js';
import { PushLog } from './push-log.entity.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { FcmService } from './fcm.service.js';
import { NotificationsService } from './notifications.service.js';

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
      }
    }
  }

  private async processPush(settings: NotificationSettings, now: Date) {
    // Check if within active hours (user's timezone)
    if (!this.isWithinActiveHours(settings, now)) {
      // Skip but still advance nextPushAt to next active window
      await this.advanceToNextActiveWindow(settings, now);
      return;
    }

    // Get user's device tokens
    const deviceTokens = await this.deviceTokenRepo.find({
      where: { userId: settings.userId, isActive: true },
    });

    if (deviceTokens.length === 0) {
      // No devices — still advance schedule
      this.updateNextPushAt(settings, now);
      await this.settingsRepo.save(settings);
      return;
    }

    // Decide: sentence push or quiz push
    const isQuizPush = Math.random() < settings.quizPushRatio;
    let pushPayload: {
      title: string;
      body: string;
      data: Record<string, string>;
      contentId?: number;
    };

    if (isQuizPush) {
      pushPayload = {
        title: '🧩 퀴즈 시간!',
        body: "오늘의 문장을 얼마나 기억하고 있나요?",
        data: { type: 'quiz', action: 'quiz' },
      };
    } else {
      // Get today's sentence for this user
      const today = now.toISOString().split('T')[0];
      const assignment = await this.assignmentRepo.findOne({
        where: { userId: settings.userId, assignedDate: today },
        relations: ['sentence'],
      });

      if (assignment) {
        pushPayload = {
          title: '📖 오늘의 문장',
          body: assignment.sentence.text,
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

    const pushLog = await this.pushLogRepo.save({
      userId: settings.userId,
      pushType: isQuizPush ? 'quiz' : 'sentence',
      contentId: pushPayload.contentId,
      status: 'pending',
    });
    pushPayload.data.pushLogId = String(pushLog.id);

    // Send push to all devices
    const tokens = deviceTokens.map((dt) => dt.token);
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

    // Update next push time
    this.updateNextPushAt(settings, now);
    await this.settingsRepo.save(settings);

    this.logger.debug(
      `Push sent to user ${settings.userId}: ${result.success} success, ${result.failure} failed`,
    );
  }

  private isWithinActiveHours(
    settings: NotificationSettings,
    now: Date,
  ): boolean {
    // Convert current time to user's timezone
    const userTime = new Date(
      now.toLocaleString('en-US', { timeZone: settings.timezone }),
    );
    const hours = userTime.getHours();
    const minutes = userTime.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    const [startH, startM] = settings.activeStartTime.split(':').map(Number);
    const [endH, endM] = settings.activeEndTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  private updateNextPushAt(settings: NotificationSettings, now: Date) {
    settings.nextPushAt = this.notificationsService.calculateNextPushAt(
      settings,
      now,
    );
  }

  private async advanceToNextActiveWindow(
    settings: NotificationSettings,
    now: Date,
  ) {
    settings.nextPushAt = this.notificationsService.calculateNextPushAt(
      settings,
      now,
    );
    await this.settingsRepo.save(settings);
  }
}
