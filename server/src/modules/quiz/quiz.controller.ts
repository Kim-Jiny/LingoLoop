import {
  Body,
  Controller,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { QuizService } from './quiz.service.js';
import { SubmitAnswerDto } from './dto/submit-answer.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../users/user.entity.js';

/**
 * The quiz is a premium-only feature. The Flutter UI gates the quiz
 * tab with `user.isPremium`, but a determined free user can just hit
 * the endpoints directly with their JWT and bypass the paywall.
 * Server-side gating is the only thing that actually enforces this.
 */
function assertPremium(user: User): void {
  if (user.subscriptionTier !== 'premium') {
    throw new ForbiddenException(
      '문장 퀴즈는 프리미엄 전용 기능이에요. 구독 후 이용해 주세요.',
    );
  }
}

@Controller('api/quiz')
export class QuizController {
  constructor(private quizService: QuizService) {}

  @Get('daily')
  getDailyQuiz(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getDailyQuiz(user.id, user.timezone);
  }

  @Post(':id/submit')
  submitAnswer(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitAnswerDto,
  ) {
    assertPremium(user);
    return this.quizService.submitAnswer(user.id, id, dto.answer);
  }

  @Get('history')
  getHistory(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    assertPremium(user);
    return this.quizService.getHistory(
      user.id,
      clamp(page, 1, Number.MAX_SAFE_INTEGER),
      clamp(limit, 1, 100),
    );
  }

  @Get('progress')
  getProgress(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getProgress(user.id);
  }

  @Get('review')
  getReviewQueue(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getReviewQueue(user.id);
  }

  @Get('words/daily')
  getDailyWordQuiz(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getDailyWordQuiz(user.id, 'normal', user.timezone);
  }

  @Get('words/listening/daily')
  getDailyWordListeningQuiz(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getDailyWordQuiz(
      user.id,
      'listening',
      user.timezone,
    );
  }

  @Get('sentence/listening/daily')
  getDailySentenceListeningQuiz(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getDailySentenceListeningQuiz(
      user.id,
      user.timezone,
    );
  }

  // ── New (2026-05 redesign) ────────────────────────────────────────
  // 오늘 = 오늘/어제 사용한 문장 + 관련 단어
  // 단어 학습 = 단어장 status='learning' (meaning→English)
  // 단어 복습 = 단어장 status='learned'
  // 문장 = 이번 달 완료된 문장 중 랜덤 (translation→full sentence)
  // ─────────────────────────────────────────────────────────────────

  @Get('today')
  getTodayQuiz(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getTodayQuiz(user.id, user.timezone);
  }

  @Get('words/learning')
  getWordLearningQuiz(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getWordTypingQuiz(
      user.id,
      'learning',
      user.timezone,
    );
  }

  @Get('words/review')
  getWordReviewQuiz(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getWordTypingQuiz(
      user.id,
      'learned',
      user.timezone,
    );
  }

  @Get('sentence/daily')
  getSentenceTypingQuiz(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getSentenceTypingQuiz(user.id, user.timezone);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
