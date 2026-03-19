import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from './device-token.entity.js';
import { NotificationSettings } from './notification-settings.entity.js';
import { PushLog } from './push-log.entity.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { FcmService } from './fcm.service.js';
import { PushSchedulerService } from './push-scheduler.service.js';
import { FirebaseConfig } from '../../config/firebase.config.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeviceToken,
      NotificationSettings,
      PushLog,
      DailyAssignment,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    FcmService,
    PushSchedulerService,
    FirebaseConfig,
  ],
  exports: [FcmService, NotificationsService],
})
export class NotificationsModule {}
