import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sentence } from './sentence.entity.js';
import { DailyAssignment } from './daily-assignment.entity.js';
import { Language } from './language.entity.js';
import { getZonedParts } from '../../common/timezone.util.js';

@Injectable()
export class SentencesService implements OnModuleInit {
  constructor(
    @InjectRepository(Sentence)
    private sentencesRepo: Repository<Sentence>,
    @InjectRepository(DailyAssignment)
    private dailyAssignmentRepo: Repository<DailyAssignment>,
    @InjectRepository(Language)
    private languageRepo: Repository<Language>,
  ) {}

  /**
   * synchronize is off in prod. Add the `track` column once and backfill
   * existing sentences from their difficulty (beginner/intermediate/
   * advanced) so those tracks have content immediately.
   */
  async onModuleInit() {
    const rows = await this.sentencesRepo.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'll_sentences' AND column_name = 'track'`,
    );
    if (!rows || rows.length === 0) {
      await this.sentencesRepo.query(
        `ALTER TABLE ll_sentences
         ADD COLUMN track varchar NOT NULL DEFAULT 'conversation'`,
      );
      await this.sentencesRepo.query(
        `UPDATE ll_sentences SET track = difficulty::text`,
      );
    }
  }

  async getToday(
    userId: string,
    languageCode = 'en',
    timezone = 'Asia/Seoul',
    track?: string | null,
  ) {
    // "Today" resets at the user's local midnight, not server UTC midnight.
    const z = getZonedParts(new Date(), timezone);
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${z.year}-${pad(z.month)}-${pad(z.day)}`;

    // Check if already assigned
    let assignment = await this.dailyAssignmentRepo.findOne({
      where: { userId, assignedDate: today },
      relations: ['sentence', 'sentence.words', 'sentence.grammarNotes'],
    });

    if (assignment) {
      return this.formatSentenceResponse(assignment);
    }

    // Find language
    const language = await this.languageRepo.findOne({
      where: { code: languageCode },
    });
    if (!language) {
      throw new NotFoundException(`Language ${languageCode} not found`);
    }

    // Resolve the effective track: only filter by it if that track
    // actually has content for this language, otherwise fall back to the
    // whole pool so the user is never left without a sentence.
    let trackFilter: string | null = null;
    if (track) {
      const trackCount = await this.sentencesRepo.count({
        where: { languageId: language.id, isActive: true, track },
      });
      if (trackCount > 0) trackFilter = track;
    }

    // Get already assigned sentence IDs for this user
    const previousAssignments = await this.dailyAssignmentRepo.find({
      where: { userId },
      select: ['sentenceId'],
    });
    const assignedIds = previousAssignments.map((a) => a.sentenceId);

    // Pick next unassigned sentence
    const queryBuilder = this.sentencesRepo
      .createQueryBuilder('sentence')
      .where('sentence.languageId = :languageId', {
        languageId: language.id,
      })
      .andWhere('sentence.isActive = :isActive', { isActive: true });

    if (trackFilter) {
      queryBuilder.andWhere('sentence.track = :track', { track: trackFilter });
    }

    if (assignedIds.length > 0) {
      queryBuilder.andWhere('sentence.id NOT IN (:...assignedIds)', {
        assignedIds,
      });
    }

    // Random among not-yet-learned sentences.
    const sentence = await queryBuilder.orderBy('RANDOM()').getOne();

    if (!sentence) {
      // All sentences seen → re-expose a random one from the same track.
      const recycle = this.sentencesRepo
        .createQueryBuilder('sentence')
        .where('sentence.languageId = :languageId', {
          languageId: language.id,
        })
        .andWhere('sentence.isActive = :isActive', { isActive: true });
      if (trackFilter) {
        recycle.andWhere('sentence.track = :track', { track: trackFilter });
      }
      const recycled = await recycle.orderBy('RANDOM()').getOne();
      if (!recycled) {
        throw new NotFoundException('No sentences available');
      }
      return this.assignAndReturn(userId, recycled.id, today);
    }

    return this.assignAndReturn(userId, sentence.id, today);
  }

  private async assignAndReturn(
    userId: string,
    sentenceId: number,
    date: string,
  ) {
    const assignment = await this.dailyAssignmentRepo.save({
      userId,
      sentenceId,
      assignedDate: date,
    });

    const fullAssignment = await this.dailyAssignmentRepo.findOne({
      where: { id: assignment.id },
      relations: ['sentence', 'sentence.words', 'sentence.grammarNotes'],
    });

    return this.formatSentenceResponse(fullAssignment!);
  }

  private formatSentenceResponse(assignment: DailyAssignment) {
    const sentence = assignment.sentence;
    return {
      assignmentId: assignment.id,
      assignedDate: assignment.assignedDate,
      isCompleted: assignment.isCompleted,
      sentence: {
        id: sentence.id,
        text: sentence.text,
        translation: sentence.translation,
        pronunciation: sentence.pronunciation,
        situation: sentence.situation,
        difficulty: sentence.difficulty,
        category: sentence.category,
        words: sentence.words
          ?.sort((a, b) => a.orderIndex - b.orderIndex)
          .map((w) => ({
            word: w.word,
            meaning: w.meaning,
            pronunciation: w.pronunciation,
            partOfSpeech: w.partOfSpeech,
            example: w.example,
          })),
        grammarNotes: sentence.grammarNotes
          ?.sort((a, b) => a.orderIndex - b.orderIndex)
          .map((g) => ({
            title: g.title,
            explanation: g.explanation,
            example: g.example,
          })),
      },
    };
  }

  async findAll(languageCode?: string) {
    const query = this.sentencesRepo
      .createQueryBuilder('sentence')
      .leftJoinAndSelect('sentence.language', 'language')
      .leftJoinAndSelect('sentence.words', 'words')
      .leftJoinAndSelect('sentence.grammarNotes', 'grammarNotes')
      .where('sentence.isActive = :isActive', { isActive: true })
      .orderBy('sentence.orderIndex', 'ASC');

    if (languageCode) {
      query.andWhere('language.code = :code', { code: languageCode });
    }

    return query.getMany();
  }

  async findOne(id: number) {
    const sentence = await this.sentencesRepo.findOne({
      where: { id },
      relations: ['words', 'grammarNotes', 'language'],
    });
    if (!sentence) {
      throw new NotFoundException(`Sentence #${id} not found`);
    }
    return sentence;
  }

  async getHistory(userId: string, page = 1, limit = 20) {
    const [assignments, total] = await this.dailyAssignmentRepo.findAndCount({
      where: { userId },
      relations: ['sentence'],
      order: { assignedDate: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: assignments.map((a) => ({
        assignedDate: a.assignedDate,
        isCompleted: a.isCompleted,
        sentence: {
          id: a.sentence.id,
          text: a.sentence.text,
          translation: a.sentence.translation,
          difficulty: a.sentence.difficulty,
        },
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async completeAssignment(userId: string, assignmentId: number) {
    const assignment = await this.dailyAssignmentRepo.findOne({
      where: { id: assignmentId, userId },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment #${assignmentId} not found`);
    }

    assignment.isCompleted = true;
    await this.dailyAssignmentRepo.save(assignment);

    return { success: true, assignmentId };
  }
}
