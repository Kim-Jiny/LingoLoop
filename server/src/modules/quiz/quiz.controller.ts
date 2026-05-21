import {
  Body,
  Controller,
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
    return this.quizService.getDailyQuiz(user.id);
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
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    assertPremium(user);
    return this.quizService.getHistory(
      user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }
}
