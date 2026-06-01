import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { SentencesService } from './sentences.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../users/user.entity.js';

@Controller('api/sentences')
export class SentencesController {
  constructor(private sentencesService: SentencesService) {}

  @Get('today')
  getToday(@CurrentUser() user: User) {
    return this.sentencesService.getToday(
      user.id,
      user.targetLanguage,
      user.timezone,
      user.learningTrack,
    );
  }

  @Get('history')
  getHistory(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.sentencesService.getHistory(
      user.id,
      clamp(page, 1, Number.MAX_SAFE_INTEGER),
      clamp(limit, 1, 100),
      user.targetLanguage,
    );
  }

  // Must be declared before @Get(':id') so "search" isn't parsed as an id.
  @Get('search')
  search(@CurrentUser() user: User, @Query('q') q?: string) {
    return this.sentencesService.searchSeen(
      user.id,
      q ?? '',
      50,
      user.targetLanguage,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sentencesService.findOne(id);
  }

  @Post('assignments/:assignmentId/complete')
  completeAssignment(
    @CurrentUser() user: User,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
  ) {
    return this.sentencesService.completeAssignment(user.id, assignmentId);
  }

  @Post('assignments/:assignmentId/skip')
  skipAssignment(
    @CurrentUser() user: User,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
  ) {
    return this.sentencesService.skipAssignment(user.id, assignmentId);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
