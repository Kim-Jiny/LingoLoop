import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from './device-token.entity.js';
import { NotificationSettings } from './notification-settings.entity.js';
import { PushLog } from './push-log.entity.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { User } from '../users/user.entity.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { FcmService } from './fcm.service.js';
import { PushSchedulerService } from './push-scheduler.service.js';
import { WidgetRefreshService } from './widget-refresh.service.js';
import { FirebaseConfig } from '../../config/firebase.config.js';
import { SentencesModule } from '../sentences/sentences.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeviceToken,
      NotificationSettings,
      PushLog,
      DailyAssignment,
      User,
    ]),
    SentencesModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    FcmService,
    PushSchedulerService,
    WidgetRefreshService,
    FirebaseConfig,
  ],
  exports: [FcmService, NotificationsService, WidgetRefreshService],
})
export class NotificationsModule {}
