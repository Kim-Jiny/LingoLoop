import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quiz } from './quiz.entity.js';
import { QuizAttempt } from './quiz-attempt.entity.js';
import { QuizService } from './quiz.service.js';
import { QuizController } from './quiz.controller.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { Sentence } from '../sentences/sentence.entity.js';
import { Word } from '../sentences/word.entity.js';
import { LearningProgress } from '../progress/learning-progress.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Quiz,
      QuizAttempt,
      DailyAssignment,
      Sentence,
      Word,
      LearningProgress,
    ]),
  ],
  controllers: [QuizController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
