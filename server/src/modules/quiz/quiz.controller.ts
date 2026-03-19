import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { QuizService } from './quiz.service.js';
import { SubmitAnswerDto } from './dto/submit-answer.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../users/user.entity.js';

@Controller('api/quiz')
export class QuizController {
  constructor(private quizService: QuizService) {}

  @Get('daily')
  getDailyQuiz(@CurrentUser() user: User) {
    return this.quizService.getDailyQuiz(user.id);
  }

  @Post(':id/submit')
  submitAnswer(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.quizService.submitAnswer(user.id, id, dto.answer);
  }

  @Get('history')
  getHistory(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.quizService.getHistory(
      user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }
}
