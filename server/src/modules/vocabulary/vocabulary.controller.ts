import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { VocabularyService } from './vocabulary.service.js';
import { AddVocabularyDto } from './dto/add-vocabulary.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../users/user.entity.js';

@Controller('api/vocabulary')
export class VocabularyController {
  constructor(private vocabularyService: VocabularyService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.vocabularyService.list(user.id);
  }

  @Post()
  add(@CurrentUser() user: User, @Body() dto: AddVocabularyDto) {
    return this.vocabularyService.add(user.id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vocabularyService.remove(user.id, id);
  }
}
