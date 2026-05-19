import { Controller, Get, Post, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ProgressService } from './progress.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../users/user.entity.js';

@Controller('api/progress')
export class ProgressController {
  constructor(private progressService: ProgressService) {}

  @Get('stats')
  getStats(@CurrentUser() user: User) {
    return this.progressService.getStats(user.id);
  }

  @Get('review')
  getReviewQueue(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
  ) {
    return this.progressService.getReviewQueue(
      user.id,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('achievements')
  getAchievements(@CurrentUser() user: User) {
    return this.progressService.getAchievements(user.id);
  }

  @Get('weekly-report')
  getWeeklyReport(@CurrentUser() user: User) {
    return this.progressService.getWeeklyReport(user.id);
  }

  @Get('heatmap')
  getHeatmap(@CurrentUser() user: User) {
    return this.progressService.getHeatmap(
      user.id,
      user.timezone,
      user.dailyGoal,
    );
  }

  @Get('sentences')
  getSentenceProgress(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.progressService.getSentenceProgress(
      user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Post('exposure/:sentenceId')
  recordExposure(
    @CurrentUser() user: User,
    @Param('sentenceId', ParseIntPipe) sentenceId: number,
  ) {
    return this.progressService.recordExposure(user.id, sentenceId);
  }
}
