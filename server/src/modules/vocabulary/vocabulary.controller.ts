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
    // user.targetLanguage 기준으로 필터 — EN 사용자가 JA bookmark를
    // 보지 않게. 클라가 명시 lang query를 안 주는 한 현재 학습 언어 사용.
    return this.vocabularyService.list(user.id, status, user.targetLanguage);
  }

  @Post()
  add(@CurrentUser() user: User, @Body() dto: AddVocabularyDto) {
    return this.vocabularyService.add(user.id, dto, user.targetLanguage);
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
   * `lang` query 없으면 사용자의 현재 학습 언어 사용.
   */
  @Get('forms/:word')
  getWordForms(
    @CurrentUser() user: User,
    @Param('word') word: string,
    @Query('lang') lang?: string,
  ) {
    return this.vocabularyService.getWordForms(
      word,
      lang ?? user.targetLanguage ?? 'en',
    );
  }
}
