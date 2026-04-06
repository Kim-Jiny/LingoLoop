import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';
import { Language } from '../sentences/language.entity.js';
import { Sentence } from '../sentences/sentence.entity.js';
import { Word } from '../sentences/word.entity.js';
import { GrammarNote } from '../sentences/grammar-note.entity.js';
import { AppConfig } from './app-config.entity.js';
import { User } from '../users/user.entity.js';
import { Subscription } from '../subscriptions/subscription.entity.js';
import { DeviceToken } from '../notifications/device-token.entity.js';
import { NotificationSettings } from '../notifications/notification-settings.entity.js';
import { PushLog } from '../notifications/push-log.entity.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { QuizAttempt } from '../quiz/quiz-attempt.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Language,
      Sentence,
      Word,
      GrammarNote,
      AppConfig,
      User,
      Subscription,
      DeviceToken,
      NotificationSettings,
      PushLog,
      DailyAssignment,
      QuizAttempt,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
