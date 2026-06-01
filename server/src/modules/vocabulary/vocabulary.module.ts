import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vocabulary } from './vocabulary.entity.js';
import { VocabularyService } from './vocabulary.service.js';
import { VocabularyController } from './vocabulary.controller.js';
import { Word } from '../sentences/word.entity.js';
import { WordForm } from '../sentences/word-form.entity.js';
import { Language } from '../sentences/language.entity.js';

@Module({
  // Word/WordForm은 북마크 시 (sentenceId + word)로 form/baseWord/POS
  // 자동 전파에 필요. WordForm은 ll_words에 baseWord가 비어있을 때
  // 사전에서 fallback 조회. Language는 다언어 — vocab 저장 시 language_id
  // 채우기 + list 필터링.
  imports: [TypeOrmModule.forFeature([Vocabulary, Word, WordForm, Language])],
  controllers: [VocabularyController],
  providers: [VocabularyService],
  exports: [VocabularyService],
})
export class VocabularyModule {}
