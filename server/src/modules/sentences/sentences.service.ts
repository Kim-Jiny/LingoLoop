import {
  Injectable,
  Logger,
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
  private readonly logger = new Logger(SentencesService.name);

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
    // 다언어 지원 — 'en'/'ja' 두 언어 row를 부팅 시 idempotent로 보장.
    // 기존엔 admin seed endpoint에서만 만들어졌는데, 자동 seed가 안 돌면
    // 신규 prod 환경에서 ll_languages가 비어 다른 모듈의 FK가 깨졌음.
    await this.languageRepo.query(
      `INSERT INTO ll_languages (code, name, "nativeName")
       VALUES ('en', 'English', '영어'),
              ('ja', 'Japanese', '일본어')
       ON CONFLICT (code) DO NOTHING`,
    );

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

    // 단어 카드 활용형/원형 메타. 북마크 시 vocab으로 전파 + ll_word_forms
    // join 키. 콘텐츠 seed/AI fill에서 채워둠. 기존 row는 null로 두고
    // 새 콘텐츠부터 채워지면 점진적으로 enrich.
    await this.sentencesRepo.query(
      `ALTER TABLE ll_words
       ADD COLUMN IF NOT EXISTS "baseWord" varchar,
       ADD COLUMN IF NOT EXISTS "form" varchar;`,
    );
  }

  async getToday(
    userId: string,
    languageCode = 'en',
    timezone = 'Asia/Seoul',
    track?: string | null,
  ) {
    // "Today" resets at the user's local midnight, not server UTC midnight.
    const today = zonedDateString(new Date(), timezone);

    // Find language up-front — 다언어 사용자의 active assignment 조회에
    // 필요. 언어가 알려지지 않으면 그 자체로 NotFoundException.
    const language = await this.languageRepo.findOne({
      where: { code: languageCode },
    });
    if (!language) {
      throw new NotFoundException(`Language ${languageCode} not found`);
    }

    // 다언어 — 현재 학습 언어의 active만 반환. EN/JA 같은 날 동시 active
    // 가능하므로 sentence.languageId까지 묶어 봐야 정확. 언어 필터 없이
    // 조회하면 사용자가 설정에서 EN→JA로 바꿔도 EN active가 그대로 떴음.
    const activeQb = this.dailyAssignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.sentence', 's')
      .leftJoinAndSelect('s.words', 'words')
      .leftJoinAndSelect('s.grammarNotes', 'grammarNotes')
      .where('a.userId = :userId', { userId })
      .andWhere('a.assignedDate = :today', { today })
      .andWhere("a.status = 'active'")
      .andWhere('s.languageId = :langId', { langId: language.id })
      .orderBy('a.id', 'DESC');
    const assignment = await activeQb.getOne();

    if (assignment) {
      return this.formatSentenceResponse(assignment);
    }

    // Resolve the effective track: only filter by it if that track
    // actually has content for this language, otherwise fall back to the
    // whole pool so the user is never left without a sentence.
    // 폴백은 의도된 안전망이지만 콘텐츠 시딩 누락의 신호이기도 해서
    // 로그 남김 (admin이 토픽 비어있는 걸 발견하게).
    let trackFilter: string | null = null;
    if (track) {
      const trackCount = await this.sentencesRepo.count({
        where: { languageId: language.id, isActive: true, track },
      });
      if (trackCount > 0) {
        trackFilter = track;
      } else {
        this.logger.warn(
          `track="${track}" has 0 sentences for language="${languageCode}". ` +
            `Falling back to full pool for user ${userId}. Seed content for this track.`,
        );
      }
    }

    // 제외 대상:
    // 1) 한 번이라도 완료한 문장 — 영구 제외 (복습으로 분기됨).
    // 2) 오늘 어떤 상태로든 이미 노출된 문장 — 같은 날 skip 직후
    //    다시 뽑혀 사용자가 "방금 그거였는데?" 하는 걸 방지.
    //    내일이 되면 다시 풀에 들어옴 ("later에 돌아옴" 보장).
    const excluded = await this.dailyAssignmentRepo
      .createQueryBuilder('a')
      // DB 컬럼은 'sentence_id' (snake_case) — entity @Column name
      // override 기준. raw select는 TypeORM의 property-name 변환을
      // 안 거치므로 실제 컬럼명을 명시해야 함. alias만 sentenceId로
      // 둬서 .getRawMany() 결과에서 r.sentenceId로 접근 가능.
      .select('DISTINCT a."sentence_id"', 'sentenceId')
      .where('a.userId = :userId', { userId })
      .andWhere("(a.status = 'completed' OR a.assignedDate = :today)", {
        today,
      })
      .getRawMany();
    const excludedIds = excluded
      .map((r) => Number(r.sentenceId))
      .filter((n) => Number.isFinite(n));

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

    if (excludedIds.length > 0) {
      queryBuilder.andWhere('sentence.id NOT IN (:...excludedIds)', {
        excludedIds,
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
   * translation. Distinct sentences, newest first. languageCode 지정 시
   * 해당 언어의 assignment만 검색 (다언어 — EN/JA 검색 분리).
   */
  async searchSeen(
    userId: string,
    q: string,
    limit = 50,
    languageCode?: string,
  ) {
    const term = `%${q.trim()}%`;
    const qb = this.dailyAssignmentRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.sentence', 's')
      .where('a.userId = :userId', { userId })
      .andWhere('(s.text ILIKE :term OR s.translation ILIKE :term)', {
        term,
      });
    if (languageCode) {
      qb.innerJoin('s.language', 'l').andWhere('l.code = :code', {
        code: languageCode,
      });
    }
    const rows = await qb
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

  async getHistory(
    userId: string,
    page = 1,
    limit = 20,
    languageCode?: string,
  ) {
    // languageCode 지정 시 해당 언어의 assignment만 — 다언어 사용자의
    // 히스토리 화면이 현재 target language만 보여주도록.
    const qb = this.dailyAssignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.sentence', 's')
      .where('a.userId = :userId', { userId });
    if (languageCode) {
      qb.innerJoin('s.language', 'l').andWhere('l.code = :code', {
        code: languageCode,
      });
    }
    const [assignments, total] = await qb
      .orderBy('a.assignedDate', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

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
