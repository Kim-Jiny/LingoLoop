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
    return this.quizService.getDailyQuiz(
      user.id,
      user.timezone,
      user.targetLanguage,
    );
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
    @Query('category') category?: string,
  ) {
    assertPremium(user);
    // category whitelist — 알 수 없는 값은 undefined로 떨궈 전체 반환.
    const allowed = [
      'today',
      'wordTyping',
      'sentenceTyping',
      'sentenceArrange',
    ];
    const filter = allowed.includes(category ?? '')
      ? (category as
          | 'today'
          | 'wordTyping'
          | 'sentenceTyping'
          | 'sentenceArrange')
      : undefined;
    return this.quizService.getHistory(
      user.id,
      clamp(page, 1, Number.MAX_SAFE_INTEGER),
      clamp(limit, 1, 100),
      filter,
      user.targetLanguage,
    );
  }

  @Get('progress')
  getProgress(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getProgress(user.id, user.targetLanguage);
  }

  @Get('review')
  getReviewQueue(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getReviewQueue(user.id, user.targetLanguage);
  }

  @Get('words/daily')
  getDailyWordQuiz(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getDailyWordQuiz(
      user.id,
      'normal',
      user.timezone,
      user.targetLanguage,
    );
  }

  @Get('words/listening/daily')
  getDailyWordListeningQuiz(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getDailyWordQuiz(
      user.id,
      'listening',
      user.timezone,
      user.targetLanguage,
    );
  }

  @Get('sentence/listening/daily')
  getDailySentenceListeningQuiz(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getDailySentenceListeningQuiz(
      user.id,
      user.timezone,
      user.targetLanguage,
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
    return this.quizService.getTodayQuiz(
      user.id,
      user.timezone,
      user.targetLanguage,
    );
  }

  @Get('words/learning')
  getWordLearningQuiz(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getWordTypingQuiz(
      user.id,
      'learning',
      user.timezone,
      user.targetLanguage,
    );
  }

  @Get('words/review')
  getWordReviewQuiz(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getWordTypingQuiz(
      user.id,
      'learned',
      user.timezone,
      user.targetLanguage,
    );
  }

  @Get('sentence/daily')
  getSentenceTypingQuiz(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getSentenceTypingQuiz(
      user.id,
      user.timezone,
      user.targetLanguage,
    );
  }

  /** 단어 배열 전용 탭 — lifetime 완료 문장 중 랜덤 10개. */
  @Get('sentence/arrange/daily')
  getSentenceArrangeQuiz(@CurrentUser() user: User) {
    assertPremium(user);
    return this.quizService.getSentenceArrangeQuiz(
      user.id,
      user.timezone,
      user.targetLanguage,
    );
  }

  // ── 오늘 문장 카드 '복습' (모든 유저) ─────────────────────────────────
  // 프리미엄 게이트 없음. 해당 문장에 대한 4문제(빈칸/어순/번역/객관식).
  // attempt는 source='sentence_review'로 분리 기록 — getHistory 통계 미반영.
  @Get('sentence/:sentenceId/review')
  getSentenceReviewQuiz(
    @CurrentUser() user: User,
    @Param('sentenceId', ParseIntPipe) sentenceId: number,
  ) {
    return this.quizService.getSentenceReviewQuiz(user.id, sentenceId);
  }

  @Post('sentence-review/:quizId/submit')
  submitSentenceReviewAnswer(
    @CurrentUser() user: User,
    @Param('quizId', ParseIntPipe) quizId: number,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.quizService.submitSentenceReviewAnswer(
      user.id,
      quizId,
      dto.answer,
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
