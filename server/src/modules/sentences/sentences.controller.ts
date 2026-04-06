import {
  Controller,
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
    return this.sentencesService.getToday(user.id, user.targetLanguage);
  }

  @Get('history')
  getHistory(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.sentencesService.getHistory(
      user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
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
}
