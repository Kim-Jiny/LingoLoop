import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';
import { BackstageController } from './backstage.controller.js';
import { AdminAuthService } from './admin-auth.service.js';
import { AdminSessionGuard } from './admin-session.guard.js';
import { AdminAccount } from './admin-account.entity.js';
import { Language } from '../sentences/language.entity.js';
import { Sentence } from '../sentences/sentence.entity.js';
import { Word } from '../sentences/word.entity.js';
import { WordForm } from '../sentences/word-form.entity.js';
import { GrammarNote } from '../sentences/grammar-note.entity.js';
import { AppConfig } from './app-config.entity.js';
import { User } from '../users/user.entity.js';
import { Subscription } from '../subscriptions/subscription.entity.js';
import { SubscriptionEvent } from '../subscriptions/subscription-event.entity.js';
import { DeviceToken } from '../notifications/device-token.entity.js';
import { NotificationSettings } from '../notifications/notification-settings.entity.js';
import { PushLog } from '../notifications/push-log.entity.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { Quiz } from '../quiz/quiz.entity.js';
import { QuizAttempt } from '../quiz/quiz-attempt.entity.js';
import { Inquiry } from '../inquiries/inquiry.entity.js';
import { InquiriesModule } from '../inquiries/inquiries.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Language,
      Sentence,
      Word,
      WordForm,
      GrammarNote,
      AppConfig,
      User,
      Subscription,
      SubscriptionEvent,
      DeviceToken,
      NotificationSettings,
      PushLog,
      DailyAssignment,
      Quiz,
      QuizAttempt,
      AdminAccount,
      Inquiry,
    ]),
    InquiriesModule,
    // 관리자 grant/revoke 시 해당 사용자에게 silent FCM 발송해 클라가
    // 즉시 구독 상태 invalidate하도록.
    NotificationsModule,
  ],
  controllers: [AdminController, BackstageController],
  providers: [AdminService, AdminAuthService, AdminSessionGuard],
})
export class AdminModule {}
