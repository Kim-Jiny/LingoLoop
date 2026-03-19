import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';
import { Language } from '../sentences/language.entity.js';
import { Sentence } from '../sentences/sentence.entity.js';
import { Word } from '../sentences/word.entity.js';
import { GrammarNote } from '../sentences/grammar-note.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Language, Sentence, Word, GrammarNote])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
