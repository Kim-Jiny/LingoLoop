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
import { LearningProgress } from '../progress/learning-progress.entity.js';
import { zonedDateString } from '../../common/timezone.util.js';

@Injectable()
export class SentencesService implements OnModuleInit {
  constructor(
    @InjectRepository(Sentence)
    private sentencesRepo: Repository<Sentence>,
    @InjectRepository(DailyAssignment)
    private dailyAssignmentRepo: Repository<DailyAssignment>,
    @InjectRepository(Language)
    private languageRepo: Repository<Language>,
    @InjectRepository(LearningProgress)
    private progressRepo: Repository<LearningProgress>,
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

    // Allow multiple assignments per day: add status column and drop the
    // legacy (user_id, assignedDate) unique constraint if present.
    await this.dailyAssignmentRepo.query(
      `ALTER TABLE ll_daily_assignments
       ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'active'`,
    );
    await this.dailyAssignmentRepo.query(
      `UPDATE ll_daily_assignments
       SET status = 'completed'
       WHERE "isCompleted" = true AND status = 'active'`,
    );

    // completed_at: precise completion timestamp. Backfill old
    // completed rows with their createdAt so historical heatmap /
    // weekly counts don't blank out after the cutover.
    await this.dailyAssignmentRepo.query(
      `ALTER TABLE ll_daily_assignments
       ADD COLUMN IF NOT EXISTS completed_at timestamp NULL`,
    );
    await this.dailyAssignmentRepo.query(
      `UPDATE ll_daily_assignments
       SET completed_at = "createdAt"
       WHERE status = 'completed' AND completed_at IS NULL`,
    );
    const cons = await this.dailyAssignmentRepo.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'll_daily_assignments'::regclass AND contype = 'u'`,
    );
    for (const c of cons ?? []) {
      await this.dailyAssignmentRepo.query(
        `ALTER TABLE ll_daily_assignments DROP CONSTRAINT IF EXISTS "${c.conname}"`,
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
    const today = zonedDateString(new Date(), timezone);

    // Return the current active sentence for today, if any.
    const assignment = await this.dailyAssignmentRepo.findOne({
      where: { userId, assignedDate: today, status: 'active' },
      relations: ['sentence', 'sentence.words', 'sentence.grammarNotes'],
      order: { id: 'DESC' },
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

    // Exclude only COMPLETED sentences (they branch off to review).
    // Skipped ones stay eligible so they can come back later.
    const completed = await this.dailyAssignmentRepo.find({
      where: { userId, status: 'completed' },
      select: ['sentenceId'],
    });
    const completedIds = completed.map((a) => a.sentenceId);

    // Pick next not-yet-learned sentence
    const queryBuilder = this.sentencesRepo
      .createQueryBuilder('sentence')
      .where('sentence.languageId = :languageId', {
        languageId: language.id,
      })
      .andWhere('sentence.isActive = :isActive', { isActive: true });

    if (trackFilter) {
      queryBuilder.andWhere('sentence.track = :track', { track: trackFilter });
    }

    if (completedIds.length > 0) {
      queryBuilder.andWhere('sentence.id NOT IN (:...completedIds)', {
        completedIds,
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
      status: 'active',
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

  /**
   * Search the sentences this user has seen (assigned), by text or
   * translation. Distinct sentences, newest first.
   */
  async searchSeen(userId: string, q: string, limit = 50) {
    const term = `%${q.trim()}%`;
    const rows = await this.dailyAssignmentRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.sentence', 's')
      .where('a.userId = :userId', { userId })
      .andWhere('(s.text ILIKE :term OR s.translation ILIKE :term)', {
        term,
      })
      .orderBy('a.assignedDate', 'DESC')
      .take(300)
      .getMany();

    const seen = new Set<number>();
    const items: any[] = [];
    for (const a of rows) {
      if (seen.has(a.sentenceId)) continue;
      seen.add(a.sentenceId);
      items.push({
        sentenceId: a.sentenceId,
        text: a.sentence.text,
        translation: a.sentence.translation,
        difficulty: a.sentence.difficulty,
        status: a.status,
        lastSeenAt: a.assignedDate,
      });
      if (items.length >= limit) break;
    }
    return { items, total: items.length };
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
    assignment.status = 'completed';
    assignment.completedAt = new Date();
    await this.dailyAssignmentRepo.save(assignment);

    // Ensure a progress row so the sentence enters the review (SRS) pool.
    let progress = await this.progressRepo.findOne({
      where: { userId, sentenceId: assignment.sentenceId },
    });
    if (!progress) {
      progress = this.progressRepo.create({
        userId,
        sentenceId: assignment.sentenceId,
        exposureCount: 1,
        quizAttempts: 0,
        quizCorrect: 0,
        masteryScore: 0,
        lastExposedAt: new Date(),
      });
      await this.progressRepo.save(progress);
    }

    return { success: true, assignmentId, status: 'completed' };
  }

  async skipAssignment(userId: string, assignmentId: number) {
    const assignment = await this.dailyAssignmentRepo.findOne({
      where: { id: assignmentId, userId },
    });
    if (!assignment) {
      throw new NotFoundException(`Assignment #${assignmentId} not found`);
    }
    // Skipped → not learned; stays eligible to be served again later.
    assignment.status = 'skipped';
    await this.dailyAssignmentRepo.save(assignment);
    return { success: true, assignmentId, status: 'skipped' };
  }
}
