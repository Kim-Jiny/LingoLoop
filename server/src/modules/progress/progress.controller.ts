import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ProgressService } from './progress.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../users/user.entity.js';

@Controller('api/progress')
export class ProgressController {
  constructor(private progressService: ProgressService) {}

  @Get('stats')
  getStats(@CurrentUser() user: User) {
    return this.progressService.getStats(user.id, user.timezone);
  }

  @Get('review')
  getReviewQueue(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const tier: 'free' | 'premium' =
      user.subscriptionTier === 'premium' ? 'premium' : 'free';
    return this.progressService.getReviewQueue(
      user.id,
      tier,
      clamp(limit, 1, 100),
    );
  }

  @Get('achievements')
  getAchievements(@CurrentUser() user: User) {
    return this.progressService.getAchievements(user.id, user.timezone);
  }

  @Get('weekly-report')
  getWeeklyReport(@CurrentUser() user: User) {
    return this.progressService.getWeeklyReport(user.id, user.timezone);
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
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.progressService.getSentenceProgress(
      user.id,
      clamp(page, 1, Number.MAX_SAFE_INTEGER),
      clamp(limit, 1, 100),
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
