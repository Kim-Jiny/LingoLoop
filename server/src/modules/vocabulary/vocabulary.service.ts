import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vocabulary } from './vocabulary.entity.js';
import { AddVocabularyDto } from './dto/add-vocabulary.dto.js';
import { UpdateVocabularyDto } from './dto/update-vocabulary.dto.js';

@Injectable()
export class VocabularyService implements OnModuleInit {
  constructor(
    @InjectRepository(Vocabulary)
    private vocabRepo: Repository<Vocabulary>,
  ) {}

  /**
   * The project runs with `synchronize` disabled outside development, so the
   * table for this newly added entity is created idempotently on boot. This
   * keeps the feature self-contained and avoids a manual migration step.
   */
  async onModuleInit() {
    await this.vocabRepo.query(`
      CREATE TABLE IF NOT EXISTS ll_vocabulary (
        id SERIAL PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES ll_users(id) ON DELETE CASCADE,
        word text NOT NULL,
        meaning text,
        context text,
        sentence_id int REFERENCES ll_sentences(id) ON DELETE SET NULL,
        status varchar NOT NULL DEFAULT 'learning',
        "createdAt" timestamp NOT NULL DEFAULT now()
      );
    `);
    // Idempotent column add for tables created before the status field.
    await this.vocabRepo.query(
      `ALTER TABLE ll_vocabulary
       ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'learning';`,
    );
    await this.vocabRepo.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_ll_vocabulary_user_word
       ON ll_vocabulary (user_id, word);`,
    );
  }

  async list(userId: string, status?: string) {
    const items = await this.vocabRepo.find({
      where: status ? { userId, status } : { userId },
      relations: ['sentence'],
      order: { createdAt: 'DESC' },
    });

    return {
      items: items.map((v) => this.serialize(v)),
      total: items.length,
    };
  }

  async updateStatus(userId: string, id: number, dto: UpdateVocabularyDto) {
    const entry = await this.vocabRepo.findOne({ where: { id, userId } });
    if (!entry) {
      throw new NotFoundException(`Vocabulary #${id} not found`);
    }
    entry.status = dto.status;
    const saved = await this.vocabRepo.save(entry);
    return this.serialize(saved);
  }

  async add(userId: string, dto: AddVocabularyDto) {
    const word = dto.word.trim();
    let entry = await this.vocabRepo.findOne({ where: { userId, word } });

    if (entry) {
      entry.meaning = dto.meaning ?? entry.meaning;
      entry.context = dto.context ?? entry.context;
      entry.sentenceId = dto.sentenceId ?? entry.sentenceId;
    } else {
      entry = this.vocabRepo.create({
        userId,
        word,
        meaning: dto.meaning ?? null,
        context: dto.context ?? null,
        sentenceId: dto.sentenceId ?? null,
      });
    }

    const saved = await this.vocabRepo.save(entry);
    return this.serialize(saved);
  }

  async remove(userId: string, id: number) {
    const entry = await this.vocabRepo.findOne({ where: { id, userId } });
    if (!entry) {
      throw new NotFoundException(`Vocabulary #${id} not found`);
    }
    await this.vocabRepo.remove(entry);
    return { success: true, id };
  }

  private serialize(v: Vocabulary) {
    return {
      id: v.id,
      word: v.word,
      meaning: v.meaning,
      context: v.context,
      sentenceId: v.sentenceId,
      sentenceText: v.sentence?.text ?? null,
      sentenceTranslation: v.sentence?.translation ?? null,
      status: v.status ?? 'learning',
      createdAt: v.createdAt,
    };
  }
}
