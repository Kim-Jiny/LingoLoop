import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from './device-token.entity.js';
import { NotificationSettings } from './notification-settings.entity.js';
import { PushLog } from './push-log.entity.js';
import { RegisterTokenDto } from './dto/register-token.dto.js';
import { UpdateNotificationSettingsDto } from './dto/update-settings.dto.js';
import { getZonedParts, zonedWallToUtc } from '../../common/timezone.util.js';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(DeviceToken)
    private deviceTokenRepo: Repository<DeviceToken>,
    @InjectRepository(NotificationSettings)
    private settingsRepo: Repository<NotificationSettings>,
    @InjectRepository(PushLog)
    private pushLogRepo: Repository<PushLog>,
  ) {}

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

    Object.assign(settings, dto);

    // If disabled, clear nextPushAt
    if (!settings.isEnabled) {
      settings.nextPushAt = null as any;
    } else {
      settings.nextPushAt = this.calculateNextPushAt(settings, new Date());
    }

    return this.settingsRepo.save(settings);
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
        frequencyMinutes: 60,
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
   */
  calculateNextPushAt(settings: NotificationSettings, from: Date): Date {
    const tz = settings.timezone || 'Asia/Seoul';
    const candidate = new Date(
      from.getTime() + settings.frequencyMinutes * 60000,
    );
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
