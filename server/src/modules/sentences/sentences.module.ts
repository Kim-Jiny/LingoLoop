import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sentence } from './sentence.entity.js';
import { Word } from './word.entity.js';
import { GrammarNote } from './grammar-note.entity.js';
import { DailyAssignment } from './daily-assignment.entity.js';
import { Language } from './language.entity.js';
import { SentencesService } from './sentences.service.js';
import { SentencesController } from './sentences.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sentence,
      Word,
      GrammarNote,
      DailyAssignment,
      Language,
    ]),
  ],
  controllers: [SentencesController],
  providers: [SentencesService],
  exports: [SentencesService],
})
export class SentencesModule {}
