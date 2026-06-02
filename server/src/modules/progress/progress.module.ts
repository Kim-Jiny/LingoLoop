import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningProgress } from './learning-progress.entity.js';
import { AchievementUnlock } from './achievement-unlock.entity.js';
import { ProgressService } from './progress.service.js';
import { ProgressController } from './progress.controller.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { QuizAttempt } from '../quiz/quiz-attempt.entity.js';
import { Vocabulary } from '../vocabulary/vocabulary.entity.js';
import { Language } from '../sentences/language.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LearningProgress,
      AchievementUnlock,
      DailyAssignment,
      QuizAttempt,
      Vocabulary,
      Language,
    ]),
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
