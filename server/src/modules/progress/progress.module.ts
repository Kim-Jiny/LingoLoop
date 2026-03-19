import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningProgress } from './learning-progress.entity.js';
import { ProgressService } from './progress.service.js';
import { ProgressController } from './progress.controller.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { QuizAttempt } from '../quiz/quiz-attempt.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([LearningProgress, DailyAssignment, QuizAttempt]),
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
