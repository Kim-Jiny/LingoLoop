import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { getDatabaseConfig } from './config/database.config.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { SentencesModule } from './modules/sentences/sentences.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { QuizModule } from './modules/quiz/quiz.module.js';
import { ProgressModule } from './modules/progress/progress.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    SentencesModule,
    AdminModule,
    NotificationsModule,
    QuizModule,
    ProgressModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
