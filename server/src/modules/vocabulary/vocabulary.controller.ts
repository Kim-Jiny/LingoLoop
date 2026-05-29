import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { VocabularyService } from './vocabulary.service.js';
import { AddVocabularyDto } from './dto/add-vocabulary.dto.js';
import { UpdateVocabularyDto } from './dto/update-vocabulary.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../users/user.entity.js';

@Controller('api/vocabulary')
export class VocabularyController {
  constructor(private vocabularyService: VocabularyService) {}

  @Get()
  list(@CurrentUser() user: User, @Query('status') status?: string) {
    return this.vocabularyService.list(user.id, status);
  }

  @Post()
  add(@CurrentUser() user: User, @Body() dto: AddVocabularyDto) {
    return this.vocabularyService.add(user.id, dto);
  }

  @Patch(':id')
  updateStatus(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVocabularyDto,
  ) {
    return this.vocabularyService.updateStatus(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.vocabularyService.remove(user.id, id);
  }

  /**
   * 단어 사전 detail. vocab detail 화면이 baseWord 또는 surface로 호출 →
   * 모든 활용형 + 한영 예문 + 품사/뜻 반환. 없으면 null.
   * languageCode 기본 'en'.
   */
  @Get('forms/:word')
  getWordForms(
    @Param('word') word: string,
    @Query('lang') lang?: string,
  ) {
    return this.vocabularyService.getWordForms(word, lang ?? 'en');
  }
}
