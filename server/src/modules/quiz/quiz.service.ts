import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Quiz, QuizType } from './quiz.entity.js';
import { QuizAttempt } from './quiz-attempt.entity.js';
import { QuizProgress } from './quiz-progress.entity.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { Sentence } from '../sentences/sentence.entity.js';
import { Word } from '../sentences/word.entity.js';
import { LearningProgress } from '../progress/learning-progress.entity.js';
import { Vocabulary } from '../vocabulary/vocabulary.entity.js';
import { Language } from '../sentences/language.entity.js';
import { zonedDateString } from '../../common/timezone.util.js';

@Injectable()
export class QuizService implements OnModuleInit {
  constructor(
    @InjectRepository(Quiz)
    private quizRepo: Repository<Quiz>,
    @InjectRepository(QuizAttempt)
    private attemptRepo: Repository<QuizAttempt>,
    @InjectRepository(QuizProgress)
    private quizProgressRepo: Repository<QuizProgress>,
    @InjectRepository(DailyAssignment)
    private assignmentRepo: Repository<DailyAssignment>,
    @InjectRepository(Sentence)
    private sentenceRepo: Repository<Sentence>,
    @InjectRepository(Word)
    private wordRepo: Repository<Word>,
    @InjectRepository(LearningProgress)
    private progressRepo: Repository<LearningProgress>,
    @InjectRepository(Vocabulary)
    private vocabRepo: Repository<Vocabulary>,
    @InjectRepository(Language)
    private languageRepo: Repository<Language>,
  ) {}

  /**
   * 다언어 — code → id 캐시. 매 quiz 요청마다 ll_languages를 hit하지 않게.
   * 캐시는 process 전역 — 새 언어 추가 시 재시작 필요(보통 빈도 낮음).
   */
  private langIdCache = new Map<string, number | null>();
  private async resolveLangId(code?: string): Promise<number | null> {
    if (!code) return null;
    if (this.langIdCache.has(code)) return this.langIdCache.get(code)!;
    const row = await this.languageRepo.findOne({ where: { code } });
    const id = row?.id ?? null;
    this.langIdCache.set(code, id);
    return id;
  }

  /**
   * synchronize off in prod — quiz_progress 테이블 idempotent CREATE.
   * 다른 모듈(progress.achievement_unlocks, inquiries 등)과 동일 패턴.
   */
  async onModuleInit() {
    await this.quizProgressRepo.query(`
      CREATE TABLE IF NOT EXISTS ll_quiz_progress (
        id SERIAL PRIMARY KEY,
        user_id varchar NOT NULL,
        quiz_id int NOT NULL,
        last_attempt_at timestamp NULL,
        last_correct_at timestamp NULL
      )
    `);
    await this.quizProgressRepo.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS ll_quiz_progress_user_quiz_uq
        ON ll_quiz_progress (user_id, quiz_id)`,
    );
    await this.quizProgressRepo.query(
      `CREATE INDEX IF NOT EXISTS ll_quiz_progress_user_lastcorrect_idx
        ON ll_quiz_progress (user_id, last_correct_at)`,
    );
    // 'sentence_review' 구분 컬럼. 1.1.1+ 이전 attempts는 NULL → 'daily'
    // 와 동급 취급(getHistory/getProgress가 source='sentence_review' 만
    // 명시적으로 제외).
    await this.attemptRepo.query(
      `ALTER TABLE ll_quiz_attempts
       ADD COLUMN IF NOT EXISTS "source" varchar NOT NULL DEFAULT 'daily'`,
    );
  }

  /**
   * Get daily quiz set for user.
   * Generates quizzes from recently learned sentences (last 7 days).
   * Returns up to 10 quiz questions.
   */
  async getDailyQuiz(
    userId: string,
    timezone = 'Asia/Seoul',
    languageCode?: string,
  ) {
    // Get sentences assigned in last 7 days, scoped to current language.
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const qb = this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.sentence', 's')
      .where('a.userId = :userId', { userId })
      .andWhere('a.createdAt >= :since', { since: sevenDaysAgo });
    if (languageCode) {
      qb.innerJoin('s.language', 'l').andWhere('l.code = :code', {
        code: languageCode,
      });
    }
    const assignments = await qb
      .orderBy('a.createdAt', 'DESC')
      .take(7)
      .getMany();

    if (assignments.length === 0) {
      return { quizzes: [], total: 0 };
    }

    const sentenceIds = assignments.map((a) => a.sentenceId);

    // Load sentences with words
    const sentences = await this.sentenceRepo.find({
      where: { id: In(sentenceIds) },
      relations: ['words'],
    });

    // Generate quizzes for each sentence (avoid duplicates today).
    // "today"는 사용자 timezone 기준 — 이전엔 UTC date라 KST 사용자가
    // UTC midnight 직후(KST 09시) 같은 quiz set을 다시 받게 됐었음.
    const today = zonedDateString(new Date(), timezone);
    // SQL의 DATE(...) 비교도 user-tz 기준으로 환산. attemptedAt/
    // createdAt이 timestamp (without tz)로 저장되는데 PG는 그걸
    // naive하게 다루므로 'UTC' tag 후 user-tz 변환.
    const localDateExpr =
      "DATE((q.createdAt AT TIME ZONE 'UTC') AT TIME ZONE :tz)";
    const attemptLocalDateExpr =
      "DATE((a.attemptedAt AT TIME ZONE 'UTC') AT TIME ZONE :tz)";
    const quizzes: Quiz[] = [];

    for (const sentence of sentences) {
      const existing = await this.quizRepo
        .createQueryBuilder('q')
        .where('q.sentenceId = :sentenceId', { sentenceId: sentence.id })
        .andWhere("q.question ->> 'mode' IS NULL")
        .andWhere("NOT (q.question ? 'vocabId')")
        .andWhere(`${localDateExpr} = :today`)
        .setParameters({ tz: timezone, today })
        .getMany();

      if (existing.length > 0) {
        quizzes.push(...existing);
        continue;
      }

      const generated = await this.generateQuizzesForSentence(sentence);
      quizzes.push(...generated);
    }

    // ll_quiz_progress 기반: 오늘 맞힌 quiz 제외 + 오래된 학습 우선 ordering.
    const ordered = await this.filterAndOrderByQuizProgress(
      quizzes,
      userId,
      timezone,
    );
    // 선택은 priority 유지(앞 10개 — 오래된 학습), 표시 순서는 매번
    // 랜덤. 안 그러면 사용자가 매번 같은 순서로 풀게 됨.
    const shuffled = this.shuffleInPlace(ordered.slice(0, 10));

    // Check which ones user already attempted today
    const quizIds = shuffled.map((q) => q.id);
    const attempts =
      quizIds.length > 0
        ? await this.attemptRepo
            .createQueryBuilder('a')
            .where('a.userId = :userId', { userId })
            .andWhere('a.quizId IN (:...quizIds)', { quizIds })
            .andWhere(`${attemptLocalDateExpr} = :today`)
            .setParameters({ tz: timezone, today })
            .getMany()
        : [];

    const attemptedIds = new Set(attempts.map((a) => a.quizId));

    // Look up difficulty per quiz via its sentence; saves the client
    // having to hit the sentence endpoint just to render a badge.
    const sentenceById = new Map(sentences.map((s) => [s.id, s]));

    return {
      quizzes: shuffled.map((q) => {
        const s = sentenceById.get(q.sentenceId);
        return {
          id: q.id,
          type: q.type,
          sentenceId: q.sentenceId,
          question: q.question,
          isAttempted: attemptedIds.has(q.id),
          difficulty: s?.difficulty ?? null,
        };
      }),
      total: shuffled.length,
    };
  }

  /**
   * "오늘의 퀴즈" — narrower window than getDailyQuiz: only sentences
   * the user actually touched today or yesterday (status active or
   * completed). Same mix of fill-blank / word-order / translation /
   * MC types per sentence, but the source is tighter so the user
   * isn't seeing week-old content under a "오늘" label.
   */
  async getTodayQuiz(
    userId: string,
    timezone = 'Asia/Seoul',
    languageCode?: string,
  ) {
    // "오늘"/"어제"를 사용자 timezone 기준으로 계산 — 이전엔 UTC라
    // 한국 사용자 KST 00:30~09:00 사이엔 KST 오늘 받은 sentence가
    // dateRange 밖이라 9시간 동안 빈 set 보였음.
    const now = new Date();
    const todayStr = zonedDateString(now, timezone);
    const yesterdayStr = zonedDateString(
      new Date(now.getTime() - 86_400_000),
      timezone,
    );
    const dateRange = [yesterdayStr, todayStr];

    const todayQb = this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.sentence', 's')
      .where('a.userId = :userId', { userId })
      .andWhere('a.assignedDate IN (:...dates)', { dates: dateRange })
      .andWhere('a.status IN (:...statuses)', {
        statuses: ['active', 'completed'],
      });
    if (languageCode) {
      todayQb.innerJoin('s.language', 'l').andWhere('l.code = :code', {
        code: languageCode,
      });
    }
    const assignments = await todayQb
      .orderBy('a.createdAt', 'DESC')
      .getMany();

    if (assignments.length === 0) return { quizzes: [], total: 0 };

    const sentenceIds = assignments.map((a) => a.sentenceId);
    const sentences = await this.sentenceRepo.find({
      where: { id: In(sentenceIds) },
      relations: ['words'],
    });

    // SQL DATE() 비교도 user-tz 기준 (DATE(timestamp) PG default는
    // session tz 의존이라 timezone-agnostic 보장 위해 명시 변환).
    const quizLocalDate =
      "DATE((q.createdAt AT TIME ZONE 'UTC') AT TIME ZONE :tz)";
    const attemptLocalDate =
      "DATE((a.attemptedAt AT TIME ZONE 'UTC') AT TIME ZONE :tz)";
    const allQuizzes: Quiz[] = [];

    for (const sentence of sentences) {
      const existing = await this.quizRepo
        .createQueryBuilder('q')
        .where('q.sentenceId = :sid', { sid: sentence.id })
        .andWhere("q.question ->> 'mode' IS NULL")
        .andWhere("NOT (q.question ? 'vocabId')")
        .andWhere(`${quizLocalDate} = :today`)
        .setParameters({ tz: timezone, today: todayStr })
        .getMany();
      if (existing.length > 0) {
        allQuizzes.push(...existing);
        continue;
      }
      allQuizzes.push(...(await this.generateQuizzesForSentence(sentence)));
    }

    // 오늘 맞힌 quiz 제외 + 오래된 학습 우선 ordering (ll_quiz_progress).
    const ordered = await this.filterAndOrderByQuizProgress(
      allQuizzes,
      userId,
      timezone,
    );
    // priority로 10개 뽑되 표시는 매번 랜덤.
    const shuffled = this.shuffleInPlace(ordered.slice(0, 10));
    const quizIds = shuffled.map((q) => q.id);
    const attempts = quizIds.length
      ? await this.attemptRepo
          .createQueryBuilder('a')
          .where('a.userId = :userId', { userId })
          .andWhere('a.quizId IN (:...quizIds)', { quizIds })
          .andWhere(`${attemptLocalDate} = :today`)
          .setParameters({ tz: timezone, today: todayStr })
          .getMany()
      : [];
    const attemptedIds = new Set(attempts.map((a) => a.quizId));
    const sentenceById = new Map(sentences.map((s) => [s.id, s]));

    return {
      quizzes: shuffled.map((q) => ({
        id: q.id,
        type: q.type,
        sentenceId: q.sentenceId,
        question: q.question,
        isAttempted: attemptedIds.has(q.id),
        difficulty: sentenceById.get(q.sentenceId)?.difficulty ?? null,
      })),
      total: shuffled.length,
    };
  }

  /**
   * "단어퀴즈" 변형 — meaning is shown, user types the English word.
   * Source filtered by vocab.status so the same generator powers
   * both "단어장학습" (status='learning') and "완료복습" (status=
   * 'learned'). The question payload carries a `hint` block so the
   * client can render the "듣기" (TTS the word) and "보기" (length
   * + first letter) hints without another round-trip.
   */
  async getWordTypingQuiz(
    userId: string,
    status: 'learning' | 'learned',
    timezone = 'Asia/Seoul',
    languageCode?: string,
  ) {
    // 사용자 전체 vocab을 풀로 — 다언어 사용자의 경우 현재 학습 언어의
    // vocab만 사용 (EN bookmark가 JA 단어 퀴즈에 안 섞이게).
    const vqb = this.vocabRepo
      .createQueryBuilder('v')
      .where('v.userId = :userId', { userId })
      .andWhere('v.status = :status', { status })
      .andWhere("v.meaning IS NOT NULL AND v.meaning <> ''");
    const langId = await this.resolveLangId(languageCode);
    if (langId != null) {
      vqb.andWhere('v.languageId = :lid', { lid: langId });
    }
    const vocab = await vqb.getMany();

    // 클라가 "단어장 비어있음" vs "오늘 풀 단어 다 떨어짐"을 구분
    // 할 수 있게 vocabCount를 항상 같이 내려보냄. vocabCount=0이면
    // 전자, >0인데 quizzes=0이면 후자(오늘 정답이라 filter됨).
    const vocabCount = vocab.length;
    if (vocab.length === 0) return { quizzes: [], total: 0, vocabCount };

    // 매 호출 다른 set이 나오게 random shuffle (이전 seed=today+status
    // 기반은 하루 종일 같은 set만 반복). 오늘 정답 제외 + 오래된 학습
    // 우선 정렬은 마지막 filterAndOrderByQuizProgress가 처리.
    const today = zonedDateString(new Date(), timezone);
    const pool = this.shuffleInPlace(vocab.slice());
    const picked = pool.slice(0, 10);

    const sentenceIds = picked
      .map((v) => v.sentenceId)
      .filter((id): id is number => id != null);
    const sentenceMap = new Map<number, Sentence>();
    if (sentenceIds.length > 0) {
      const sentences = await this.sentenceRepo.find({
        where: { id: In(sentenceIds) },
      });
      for (const s of sentences) sentenceMap.set(s.id, s);
    }

    const quizzes: Array<any> = [];
    for (const v of picked) {
      // sentenceId is required by the Quiz schema (FK) but for vocab
      // added without a source we fall back to anchoring on any
      // existing sentence we have. Skip if neither is available.
      const sourceSentence = v.sentenceId
        ? sentenceMap.get(v.sentenceId)
        : null;
      if (!sourceSentence) continue;

      // Dedupe per (vocab + mode + day) so reopening the tab doesn't
      // create duplicate Quiz rows.
      const existing = await this.quizRepo
        .createQueryBuilder('q')
        .where('q.sentenceId = :sid', { sid: sourceSentence.id })
        .andWhere('q.type = :type', { type: QuizType.FILL_BLANK })
        .andWhere("q.question ->> 'vocabId' = :vid", { vid: String(v.id) })
        .andWhere("q.question ->> 'mode' = :mode", { mode: 'word_to_english' })
        .andWhere(
          "DATE((q.createdAt AT TIME ZONE 'UTC') AT TIME ZONE :tz) = :today",
        )
        .setParameters({ tz: timezone, today })
        .getOne();
      if (existing) {
        quizzes.push({
          id: existing.id,
          type: existing.type,
          sentenceId: existing.sentenceId,
          question: existing.question,
          isAttempted: false,
          difficulty: sourceSentence.difficulty,
        });
        continue;
      }

      const visual = buildWordVisualHint(v.word);
      const quiz = await this.quizRepo.save({
        sentenceId: sourceSentence.id,
        type: QuizType.FILL_BLANK,
        question: {
          meaning: v.meaning,
          context: v.context ?? sourceSentence.text,
          mode: 'word_to_english',
          vocabId: v.id,
          // hint.audio carries the TTS target; hint.visual is the
          // shown-as-typed mask ("h___" for "hand").
          hint: { audio: v.word, visual },
        },
        answer: {
          word: v.word,
          fullSentence: sourceSentence.text,
          vocabId: v.id,
        },
      });
      quizzes.push({
        id: quiz.id,
        type: quiz.type,
        sentenceId: quiz.sentenceId,
        question: quiz.question,
        isAttempted: false,
        difficulty: sourceSentence.difficulty,
      });
    }

    const ordered = await this.filterAndOrderByQuizProgress(
      quizzes,
      userId,
      timezone,
    );
    // 표시 순서는 매번 랜덤 — priority는 선택(앞쪽)에만 영향, presentation은 섞기.
    this.shuffleInPlace(ordered);
    return { quizzes: ordered, total: ordered.length, vocabCount };
  }

  /**
   * "문장퀴즈" — random monthly completed sentence, user types the
   * full English from a Korean translation prompt. Hints: 듣기
   * (full sentence TTS) + 보기 (~30% of words pre-filled, the rest
   * masked with `_`). Both hints can be active simultaneously on the
   * client.
   */
  async getSentenceTypingQuiz(
    userId: string,
    timezone = 'Asia/Seoul',
    languageCode?: string,
  ) {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    // Completed-this-month, dedup by sentence — 현재 학습 언어로 한정.
    const stQb = this.assignmentRepo
      .createQueryBuilder('a')
      .select('DISTINCT a.sentenceId', 'sid')
      .where('a.userId = :userId', { userId })
      .andWhere("a.status = 'completed'")
      .andWhere('a.completedAt IS NOT NULL')
      .andWhere('a.completedAt >= :since', { since: monthStart });
    if (languageCode) {
      stQb
        .innerJoin('a.sentence', 's')
        .innerJoin('s.language', 'l')
        .andWhere('l.code = :code', { code: languageCode });
    }
    const rows = await stQb.getRawMany();
    const candidateIds = rows
      .map((r) => Number(r.sid))
      .filter((n) => !Number.isNaN(n));
    if (candidateIds.length === 0) return { quizzes: [], total: 0 };

    // 매 호출 다른 set이 나오게 random shuffle (seed 기반 deterministic
    // 제거). 오늘 정답 제외 + 오래된 학습 우선은 helper가 처리.
    const today = zonedDateString(new Date(), timezone);
    const pickedIds = this.shuffleInPlace(candidateIds.slice()).slice(0, 10);

    const sentences = await this.sentenceRepo.find({
      where: { id: In(pickedIds) },
    });
    const byId = new Map(sentences.map((s) => [s.id, s]));

    const quizzes: Array<any> = [];
    for (const id of pickedIds) {
      const sentence = byId.get(id);
      if (!sentence || !sentence.translation) continue;

      const existing = await this.quizRepo
        .createQueryBuilder('q')
        .where('q.sentenceId = :sid', { sid: sentence.id })
        .andWhere('q.type = :type', { type: QuizType.FILL_BLANK })
        .andWhere("q.question ->> 'mode' = :mode", { mode: 'sentence_input' })
        .andWhere(
          "DATE((q.createdAt AT TIME ZONE 'UTC') AT TIME ZONE :tz) = :today",
        )
        .setParameters({ tz: timezone, today })
        .getOne();
      if (existing) {
        quizzes.push({
          id: existing.id,
          type: existing.type,
          sentenceId: existing.sentenceId,
          question: existing.question,
          isAttempted: false,
          difficulty: sentence.difficulty,
        });
        continue;
      }

      const partialMask = buildSentencePartialMask(sentence.text);
      const quiz = await this.quizRepo.save({
        sentenceId: sentence.id,
        type: QuizType.FILL_BLANK,
        question: {
          translation: sentence.translation,
          mode: 'sentence_input',
          // hint.audio = full sentence for TTS, hint.visual = the 30%
          // pre-filled pattern. Client toggles each independently.
          hint: { audio: sentence.text, visual: partialMask },
        },
        answer: {
          sentence: sentence.text,
          fullSentence: sentence.text,
        },
      });
      quizzes.push({
        id: quiz.id,
        type: quiz.type,
        sentenceId: quiz.sentenceId,
        question: quiz.question,
        isAttempted: false,
        difficulty: sentence.difficulty,
      });
    }

    const prioritized = await this.filterAndOrderByQuizProgress(
      quizzes,
      userId,
      timezone,
    );
    this.shuffleInPlace(prioritized);
    return { quizzes: prioritized, total: prioritized.length };
  }

  /**
   * "단어 배열" 전용 quiz. source = 사용자가 lifetime 동안 완료한
   * 모든 sentence. 매 호출 random 10개 sample. sentence별 WORD_ORDER
   * quiz가 없으면 즉시 생성 (mode='arrange'로 marking해 today
   * sentence quiz의 word_order와 분리). 이미 있으면 재사용.
   *
   * 같은 sentence quiz가 재사용되니 client 측 shuffled order는 매번
   * 동일 — sample이 random이라 같은 sentence가 자주 재출현 안 하고,
   * filterAndOrderByQuizProgress가 오늘 정답 제외라 같은 날 두 번
   * 안 나옴. 답 외우기 어려움.
   */
  async getSentenceArrangeQuiz(
    userId: string,
    timezone = 'Asia/Seoul',
    languageCode?: string,
  ) {
    // 사용자 학습 완료 전체 sentence id (distinct) — 현재 학습 언어만.
    const saQb = this.assignmentRepo
      .createQueryBuilder('a')
      .select('DISTINCT a.sentenceId', 'sid')
      .where('a.userId = :userId', { userId })
      .andWhere("a.status = 'completed'")
      .andWhere('a.completedAt IS NOT NULL');
    if (languageCode) {
      saQb
        .innerJoin('a.sentence', 's')
        .innerJoin('s.language', 'l')
        .andWhere('l.code = :code', { code: languageCode });
    }
    const rows = await saQb.getRawMany();
    const candidateIds = rows
      .map((r) => Number(r.sid))
      .filter((n) => !Number.isNaN(n));
    if (candidateIds.length === 0) return { quizzes: [], total: 0 };

    const pickedIds = this.shuffleInPlace(candidateIds.slice()).slice(0, 10);
    const sentences = await this.sentenceRepo.find({
      where: { id: In(pickedIds) },
    });
    const byId = new Map(sentences.map((s) => [s.id, s]));

    const quizzes: Array<any> = [];
    for (const sid of pickedIds) {
      const sentence = byId.get(sid);
      if (!sentence) continue;

      // dedup: 같은 sentence + WORD_ORDER + mode='arrange' 한 row만 유지.
      const existing = await this.quizRepo
        .createQueryBuilder('q')
        .where('q.sentenceId = :sid', { sid: sentence.id })
        .andWhere('q.type = :type', { type: QuizType.WORD_ORDER })
        .andWhere("q.question ->> 'mode' = :mode", { mode: 'arrange' })
        .getOne();
      const quiz = existing ?? (await this.generateArrangeQuiz(sentence));
      if (!quiz) continue;
      quizzes.push({
        id: quiz.id,
        type: quiz.type,
        sentenceId: quiz.sentenceId,
        question: quiz.question,
        isAttempted: false,
        difficulty: sentence.difficulty,
      });
    }

    const prioritized = await this.filterAndOrderByQuizProgress(
      quizzes,
      userId,
      timezone,
    );
    this.shuffleInPlace(prioritized);
    return { quizzes: prioritized, total: prioritized.length };
  }

  /**
   * 한 문장에 대해 WORD_ORDER mode='arrange' quiz 한 row 생성. 3단어
   * 미만이면 null (배열 의미 없음). shuffled가 원래 순서와 동일하면
   * reverse로 강제 변형.
   */
  private async generateArrangeQuiz(sentence: Sentence): Promise<Quiz | null> {
    const words = sentence.text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    if (words.length < 3) return null;
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    if (shuffled.join(' ') === words.join(' ')) shuffled.reverse();
    return this.quizRepo.save({
      sentenceId: sentence.id,
      type: QuizType.WORD_ORDER,
      question: {
        words: shuffled,
        translation: sentence.translation,
        mode: 'arrange',
      },
      answer: {
        correctOrder: words,
        fullSentence: sentence.text,
      },
    });
  }

  /**
   * Submit a quiz answer and return result.
   */
  /**
   * 오늘 문장 카드의 '복습' 버튼 — 해당 문장에 대한 4문제(빈칸/어순/번역/
   * 객관식)를 모아 반환. 프리미엄 게이트 없음(모든 유저). 단, 무작위
   * sentenceId enumeration 방지를 위해 사용자가 한 번이라도 assign된 문장
   * 인지 확인.
   */
  async getSentenceReviewQuiz(
    userId: string,
    sentenceId: number,
    languageCode?: string,
  ) {
    const assigned = await this.assignmentRepo
      .createQueryBuilder('a')
      .where('a.userId = :userId', { userId })
      .andWhere('a.sentenceId = :sentenceId', { sentenceId })
      .getCount();
    if (assigned === 0) {
      throw new NotFoundException('할당된 적 없는 문장이에요.');
    }
    const sentence = await this.sentenceRepo.findOne({
      where: { id: sentenceId },
      relations: ['words', 'language'],
    });
    if (!sentence) {
      throw new NotFoundException('문장을 찾을 수 없어요.');
    }
    // 현재 학습 언어와 다른 sentence는 접근 거부 — 사용자가 JA 모드일 때
    // 옛 EN 문장의 review 화면이 뜨면 혼란. 같은 언어만 허용.
    if (languageCode && sentence.language?.code !== languageCode) {
      throw new NotFoundException('현재 학습 언어의 문장이 아니에요.');
    }

    // 같은 sentence에 이미 quiz가 있으면 재사용. 단어/어순/번역/객관식
    // 모드만 (mode 키 없는 row). 같은 문장이 daily quiz로 여러 날 생성
    // 되면 (sentenceId, type)에 중복 row가 누적되므로 type별 최신 1개만.
    const all = await this.quizRepo
      .createQueryBuilder('q')
      .where('q.sentenceId = :sid', { sid: sentenceId })
      .andWhere("q.question ->> 'mode' IS NULL")
      .andWhere("NOT (q.question ? 'vocabId')")
      .orderBy('q.createdAt', 'DESC')
      .getMany();
    const byType = new Map<string, Quiz>();
    for (const q of all) {
      if (!byType.has(q.type)) byType.set(q.type, q);
    }
    let quizzes = Array.from(byType.values());
    // 한 번도 생성된 적 없거나 type이 부족하면 새 set 생성 (generate는
    // 최대 4개 type을 한 번에 만듦).
    if (quizzes.length === 0) {
      quizzes = await this.generateQuizzesForSentence(sentence);
    }

    return {
      quizzes: quizzes.map((q) => ({
        id: q.id,
        type: q.type,
        sentenceId: q.sentenceId,
        question: q.question,
        isAttempted: false,
        sentence: {
          id: sentence.id,
          text: sentence.text,
          translation: sentence.translation,
        },
      })),
      total: quizzes.length,
    };
  }

  /**
   * 위 sentence-review 흐름 전용 submit. attempt에 source='sentence_review'
   * 기록만 하고 progress/streak는 건드리지 않음 — 프리미엄 일일 퀴즈 통계
   * 와 완전 분리.
   */
  async submitSentenceReviewAnswer(
    userId: string,
    quizId: number,
    userAnswer: Record<string, any>,
    languageCode?: string,
  ) {
    const quiz = await this.quizRepo.findOne({
      where: { id: quizId },
      relations: ['sentence', 'sentence.words', 'sentence.grammarNotes', 'sentence.language'],
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    // ownership: 해당 quiz의 sentence가 사용자에게 한 번이라도 assign된
    // 적이 있어야 submit 허용. GET 측 anti-enumeration과 동일한 정책.
    const assigned = await this.assignmentRepo
      .createQueryBuilder('a')
      .where('a.userId = :userId', { userId })
      .andWhere('a.sentenceId = :sentenceId', { sentenceId: quiz.sentenceId })
      .getCount();
    if (assigned === 0) {
      throw new NotFoundException('할당된 적 없는 문장이에요.');
    }
    // GET 측과 동일한 언어 게이트 — JA 모드에서 EN quiz submit 차단.
    if (languageCode && quiz.sentence?.language?.code !== languageCode) {
      throw new NotFoundException('현재 학습 언어의 문장이 아니에요.');
    }
    const isCorrect = this.checkAnswer(quiz, userAnswer);
    const attempt = await this.attemptRepo.save({
      userId,
      quizId,
      userAnswer,
      isCorrect,
      source: 'sentence_review',
    });
    return {
      attemptId: attempt.id,
      isCorrect,
      correctAnswer: quiz.answer,
      explanation: this.buildExplanation(quiz),
    };
  }

  async submitAnswer(
    userId: string,
    quizId: number,
    userAnswer: Record<string, any>,
  ) {
    const quiz = await this.quizRepo.findOne({
      where: { id: quizId },
      relations: ['sentence', 'sentence.words', 'sentence.grammarNotes'],
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    const isCorrect = this.checkAnswer(quiz, userAnswer);

    // Save attempt
    const attempt = await this.attemptRepo.save({
      userId,
      quizId,
      userAnswer,
      isCorrect,
    });

    // Update learning progress
    await this.updateProgress(userId, quiz.sentenceId, isCorrect);

    // ll_quiz_progress upsert — lastAttemptAt 매번, lastCorrectAt은
    // 정답일 때만 갱신. ON CONFLICT의 COALESCE(EXCLUDED.last_correct_at,
    // existing) 패턴으로 오답이어도 기존 last_correct_at 보존.
    // raw SQL — TypeORM upsert는 partial-column COALESCE 표현이 까다로움.
    const now = new Date();
    await this.quizProgressRepo.query(
      `INSERT INTO ll_quiz_progress (user_id, quiz_id, last_attempt_at, last_correct_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, quiz_id) DO UPDATE SET
         last_attempt_at = EXCLUDED.last_attempt_at,
         last_correct_at = COALESCE(EXCLUDED.last_correct_at, ll_quiz_progress.last_correct_at)`,
      [userId, quizId, now, isCorrect ? now : null],
    );

    return {
      attemptId: attempt.id,
      isCorrect,
      correctAnswer: quiz.answer,
      explanation: this.buildExplanation(quiz),
    };
  }

  /**
   * Assemble the post-attempt explanation card. Pulls the full
   * sentence, its translation, every word with meaning + example,
   * and any attached grammar notes so the client can render a
   * compact "왜 이게 정답이야?" panel after every wrong answer (and
   * a confidence-boosting summary after correct ones).
   *
   * Per quiz type we also stash a `focus` field pointing the client
   * at the salient slice (the masked word, the relevant grammar
   * point, the meaning that was being tested).
   */
  private buildExplanation(quiz: Quiz) {
    const sentence = quiz.sentence;
    const words = (sentence?.words ?? [])
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((w) => ({
        word: w.word,
        meaning: w.meaning,
        partOfSpeech: w.partOfSpeech ?? null,
        pronunciation: w.pronunciation ?? null,
        example: w.example ?? null,
      }));
    const grammarNotes = (sentence?.grammarNotes ?? [])
      .slice()
      .sort((a, b) => (a as any).orderIndex - (b as any).orderIndex)
      .map((g) => ({
        title: g.title ?? null,
        explanation: g.explanation ?? null,
        example: g.example ?? null,
      }));

    let focus: Record<string, any> | null = null;
    switch (quiz.type) {
      case QuizType.FILL_BLANK:
        focus = {
          kind: 'word',
          word: quiz.answer?.word ?? null,
        };
        break;
      case QuizType.MULTIPLE_CHOICE:
        focus = {
          kind: 'word',
          word: quiz.question?.word ?? null,
          meaning: quiz.answer?.correctMeaning ?? null,
        };
        break;
      case QuizType.TRANSLATION:
      case QuizType.WORD_ORDER:
        focus = {
          kind: 'sentence',
          difficulty: sentence?.difficulty ?? null,
          situation: sentence?.situation ?? null,
        };
        break;
    }

    return {
      fullSentence: sentence?.text ?? null,
      translation: sentence?.translation ?? null,
      pronunciation: sentence?.pronunciation ?? null,
      difficulty: sentence?.difficulty ?? null,
      situation: sentence?.situation ?? null,
      words,
      grammarNotes,
      focus,
    };
  }

  /**
   * Personal-vocabulary quiz set. Pulls up to 10 distinct words from
   * the user's saved vocabulary (status='learning'), and for each
   * generates either a 4-way word→meaning MC or, when there aren't
   * enough distractor meanings, falls back to a meaning→word typed
   * blank. Reuses the existing Quiz table + submitAnswer flow so
   * progress + history endpoints work unmodified.
   *
   * We dedupe by (word + sentenceId) and rotate today's pick so the
   * user doesn't see the same 10 words every day — a stable
   * deterministic shuffle keyed on YYYY-MM-DD gives them a fresh
   * mix without us having to track "shown today".
   */
  async getDailyWordQuiz(
    userId: string,
    mode: 'normal' | 'listening' = 'normal',
    timezone = 'Asia/Seoul',
    languageCode?: string,
  ) {
    // 사용자 전체 learning vocab을 풀로 — 다언어: 현재 학습 언어만.
    const dwqQb = this.vocabRepo
      .createQueryBuilder('v')
      .where('v.userId = :userId', { userId })
      .andWhere("v.status = 'learning'")
      .andWhere('v.meaning IS NOT NULL AND v.meaning <> :empty', { empty: '' });
    const dwqLangId = await this.resolveLangId(languageCode);
    if (dwqLangId != null) {
      dwqQb.andWhere('v.languageId = :lid', { lid: dwqLangId });
    }
    const vocab = await dwqQb.getMany();

    if (vocab.length === 0) {
      return { quizzes: [], total: 0 };
    }

    // 매 호출 random shuffle — seed 기반 deterministic 제거. 사용자가
    // 같은 날 여러 번 호출해도 다른 set이 나오고, 오늘 정답 제외 +
    // 오래된 학습 우선은 filterAndOrderByQuizProgress가 처리.
    const today = zonedDateString(new Date(), timezone);
    const pool = this.shuffleInPlace(vocab.slice());
    const picked = pool.slice(0, 10);
    const today2 = today; // alias for the existing-quiz dedup query below

    // Distractor pool: all distinct meanings from this user's vocab
    // (including the picked ones — we exclude the current vocab's own
    // meaning per-iteration via `m !== v.meaning`, so reusing picked
    // meanings as distractors is fine). Critical for users with ≤10
    // vocab where `picked` covers everything; before this change those
    // users got an empty distractor pool and zero listening quizzes.
    const distinctUserMeanings = Array.from(
      new Set(vocab.map((v) => v.meaning).filter((m): m is string => !!m)),
    );

    // If the user's own pool can't reliably give 3 distractors per
    // quiz (need ≥4 distinct meanings total: 1 correct + 3 distractor),
    // pad from other users' vocab. Bookmarked words from real learners
    // are at least plausible Korean meanings — far better than dropping
    // the quiz entirely on a low-diversity vocab.
    const distractorPool = distinctUserMeanings;
    if (distractorPool.length < 4) {
      const padRows: Array<{ meaning: string }> = await this.vocabRepo
        .createQueryBuilder('v')
        .select('DISTINCT v.meaning', 'meaning')
        .where('v.userId != :userId', { userId })
        .andWhere("v.meaning IS NOT NULL AND v.meaning <> ''")
        .orderBy('RANDOM()')
        .limit(20)
        .getRawMany();
      const known = new Set(distractorPool);
      for (const r of padRows) {
        if (r.meaning && !known.has(r.meaning)) {
          distractorPool.push(r.meaning);
          known.add(r.meaning);
        }
      }
    }

    // Batch-load every sentence the picked vocab refs in one query —
    // avoids the per-row findOne fan-out that was issuing 10 round
    // trips per call.
    const sentenceIds = picked
      .map((v) => v.sentenceId)
      .filter((id): id is number => id != null);
    const sentenceMap = new Map<number, Sentence>();
    if (sentenceIds.length > 0) {
      const sentences = await this.sentenceRepo.find({
        where: { id: In(sentenceIds) },
      });
      for (const s of sentences) sentenceMap.set(s.id, s);
    }

    const quizzes: Array<{
      id: number;
      type: QuizType;
      sentenceId: number;
      question: Record<string, any>;
      isAttempted: boolean;
      difficulty: string | null;
    }> = [];

    for (const v of picked) {
      // Word quiz requires a source sentence for context + difficulty.
      // Vocab entries added without a sentence (manual add) skip.
      if (!v.sentenceId) continue;

      const sentence = sentenceMap.get(v.sentenceId);
      if (!sentence) continue;

      // Reuse / dedupe: same word + same day + same mode is the
      // same quiz row. mode is part of the dedup key so the
      // listening tab can have its own attempt history per day.
      const existing = await this.quizRepo
        .createQueryBuilder('q')
        .where('q.sentenceId = :sentenceId', { sentenceId: v.sentenceId })
        .andWhere('q.type = :type', { type: QuizType.MULTIPLE_CHOICE })
        .andWhere("q.question ->> 'vocabId' = :vid", { vid: String(v.id) })
        .andWhere("COALESCE(q.question ->> 'mode', 'normal') = :mode", { mode })
        .andWhere(
          "DATE((q.createdAt AT TIME ZONE 'UTC') AT TIME ZONE :tz) = :today",
        )
        .setParameters({ tz: timezone, today: today2 })
        .getOne();
      if (existing) {
        quizzes.push({
          id: existing.id,
          type: existing.type,
          sentenceId: existing.sentenceId,
          question: existing.question,
          isAttempted: false,
          difficulty: sentence.difficulty,
        });
        continue;
      }

      // Build 4-way MC with 3 distractor meanings from the user's
      // own vocab. Falls through to free-text if we can't gather 3.
      const distractors = distractorPool
        .filter((m) => m !== v.meaning)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      if (distractors.length >= 3) {
        const options = [v.meaning!, ...distractors].sort(
          () => Math.random() - 0.5,
        );
        const correctIndex = options.indexOf(v.meaning!);
        const quiz = await this.quizRepo.save({
          sentenceId: v.sentenceId,
          type: QuizType.MULTIPLE_CHOICE,
          question: {
            word: v.word,
            context: v.context ?? sentence.text,
            options,
            vocabId: v.id,
            // 'listening' tells the client to hide the word and show
            // a TTS play button instead — same data shape, different
            // input modality. We still send the word so the client
            // has something to feed into TTS.
            mode,
          },
          answer: {
            correctIndex,
            correctMeaning: v.meaning,
            vocabId: v.id,
          },
        });
        quizzes.push({
          id: quiz.id,
          type: quiz.type,
          sentenceId: quiz.sentenceId,
          question: quiz.question,
          isAttempted: false,
          difficulty: sentence.difficulty,
        });
      } else {
        // Too few distractors even after system padding — fall back to
        // a typed answer instead of dropping the quiz. Listening mode
        // still plays TTS of the word; the user types what they hear.
        const isListening = mode === 'listening';
        const quiz = await this.quizRepo.save({
          sentenceId: v.sentenceId,
          type: QuizType.FILL_BLANK,
          question: {
            sentence: isListening
              ? '들리는 단어를 입력해주세요'
              : `(${v.meaning}) ______`,
            // Hint reveals the spelling indirectly — keep it on normal,
            // hide on listening so the audio actually drives the answer.
            ...(isListening ? {} : { hint: v.meaning }),
            translation: sentence.translation,
            vocabId: v.id,
            ...(isListening ? { mode: 'listening', fullSentence: v.word } : {}),
          },
          answer: {
            word: v.word,
            fullSentence: sentence.text,
            vocabId: v.id,
          },
        });
        quizzes.push({
          id: quiz.id,
          type: quiz.type,
          sentenceId: quiz.sentenceId,
          question: quiz.question,
          isAttempted: false,
          difficulty: sentence.difficulty,
        });
      }
    }

    const ordered = await this.filterAndOrderByQuizProgress(
      quizzes,
      userId,
      timezone,
    );
    this.shuffleInPlace(ordered);
    return { quizzes: ordered, total: ordered.length };
  }

  /**
   * Spaced-repetition style review queue. Pulls quizzes the user
   * has historically gotten wrong (last 30 days), prioritised by:
   *   1. Quizzes wrong AND not retried correctly since
   *   2. Quizzes with the lowest mastery score
   *   3. Older mistakes (longer interval, more value in re-review)
   *
   * Returns up to 10 review items in the same shape as getDailyQuiz
   * so the client can reuse the same quiz-runner widgets.
   *
   * Note: this is the simplest useful SRS — no SM-2 interval math
   * yet, just "wrong things bubble to the top until you get them
   * right twice in a row." Good enough for v1; add proper intervals
   * once we have real usage data.
   */
  async getReviewQueue(userId: string, languageCode?: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // All recent attempts joined to quiz + sentence so we can rank.
    // 다언어 — 현재 학습 언어의 quiz attempt만.
    const rqQb = this.attemptRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.quiz', 'q')
      .where('a.userId = :userId', { userId })
      .andWhere('a.attemptedAt >= :since', { since: thirtyDaysAgo });
    if (languageCode) {
      rqQb
        .innerJoin('q.sentence', 's')
        .innerJoin('s.language', 'l')
        .andWhere('l.code = :code', { code: languageCode });
    }
    const attempts = await rqQb.orderBy('a.attemptedAt', 'DESC').getMany();

    // Reduce to per-quiz state: last result + last attempt time.
    type Entry = { quizId: number; wrong: boolean; lastAt: Date };
    const byQuiz = new Map<number, Entry>();
    for (const a of attempts) {
      if (!byQuiz.has(a.quizId)) {
        byQuiz.set(a.quizId, {
          quizId: a.quizId,
          wrong: !a.isCorrect,
          lastAt: a.attemptedAt,
        });
      }
    }
    // Keep only the ones whose MOST RECENT attempt was wrong.
    const candidates = [...byQuiz.values()]
      .filter((e) => e.wrong)
      // Older mistakes (further from now) sort first — they need
      // re-exposure more than something the user just missed.
      .sort((a, b) => a.lastAt.getTime() - b.lastAt.getTime())
      .slice(0, 10);

    if (candidates.length === 0) {
      return { quizzes: [], total: 0 };
    }

    const quizzes = await this.quizRepo.find({
      where: { id: In(candidates.map((c) => c.quizId)) },
      relations: ['sentence'],
    });
    // Preserve our sorted order; .find() doesn't keep input order.
    const quizById = new Map(quizzes.map((q) => [q.id, q]));

    // 선택은 oldest-first priority로 끝났고, 표시는 매번 랜덤.
    const mapped = candidates
      .map((c) => quizById.get(c.quizId))
      .filter((q): q is Quiz => !!q)
      .map((q) => ({
        id: q.id,
        type: q.type,
        sentenceId: q.sentenceId,
        question: q.question,
        difficulty: q.sentence?.difficulty ?? null,
        isAttempted: false, // we WANT them to attempt again
      }));
    this.shuffleInPlace(mapped);
    return {
      quizzes: mapped,
      total: candidates.length,
    };
  }

  /**
   * Per-difficulty mastery snapshot for the user. Aggregates the
   * existing `ll_learning_progress` rows by the sentence's
   * difficulty bucket so the quiz screen can render a "초급 75% /
   * 중급 42% / 고급 12%" progress bar without the client needing
   * the full history.
   */
  async getProgress(userId: string, languageCode?: string) {
    // Join progress → sentences to pivot mastery by difficulty.
    // 다언어 — languageCode 지정 시 해당 언어 sentence만 집계.
    const langCondition = languageCode
      ? `AND s.language_id = (SELECT id FROM ll_languages WHERE code = $2)`
      : '';
    const params: unknown[] = languageCode ? [userId, languageCode] : [userId];
    const rows: Array<{
      difficulty: string;
      total: string;
      attempts: string;
      correct: string;
      avg_mastery: string;
    }> = await this.progressRepo.query(
      `SELECT s.difficulty,
              COUNT(*)::text AS total,
              COALESCE(SUM(p."quizAttempts"), 0)::text AS attempts,
              COALESCE(SUM(p."quizCorrect"), 0)::text AS correct,
              COALESCE(AVG(p."masteryScore"), 0)::text AS avg_mastery
         FROM ll_learning_progress p
         JOIN ll_sentences s ON s.id = p.sentence_id
        WHERE p.user_id = $1
          ${langCondition}
        GROUP BY s.difficulty`,
      params,
    );

    const byDifficulty: Record<
      string,
      { sentences: number; attempts: number; correct: number; mastery: number }
    > = {};
    let totalAttempts = 0;
    let totalCorrect = 0;
    let totalSentences = 0;
    for (const r of rows) {
      const sentences = parseInt(r.total, 10) || 0;
      const attempts = parseInt(r.attempts, 10) || 0;
      const correct = parseInt(r.correct, 10) || 0;
      const mastery = Math.round(parseFloat(r.avg_mastery) || 0);
      byDifficulty[r.difficulty] = { sentences, attempts, correct, mastery };
      totalAttempts += attempts;
      totalCorrect += correct;
      totalSentences += sentences;
    }
    return {
      overall: {
        sentences: totalSentences,
        attempts: totalAttempts,
        correct: totalCorrect,
        accuracy:
          totalAttempts > 0
            ? Math.round((totalCorrect / totalAttempts) * 100)
            : 0,
      },
      byDifficulty,
    };
  }

  /**
   * Get quiz history for user. `category`로 quiz tab과 일치하는 분류
   * 적용 — 단어 quiz였는데 sentence 텍스트가 표시돼 혼동되던 문제를
   * 해결. category 미지정이면 전체.
   *
   *   today           : sentence-based mixed (mode IS NULL, no vocabId)
   *   wordTyping      : 단어장 → 영어 입력 (mode='word_to_english')
   *   sentenceTyping  : 한글 뜻 → 영어 문장 입력 (mode='sentence_input')
   *   sentenceArrange : 단어 배열 (mode='arrange')
   */
  async getHistory(
    userId: string,
    page = 1,
    limit = 20,
    category?: 'today' | 'wordTyping' | 'sentenceTyping' | 'sentenceArrange',
    languageCode?: string,
  ) {
    const qb = this.attemptRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.quiz', 'q')
      .leftJoinAndSelect('q.sentence', 's')
      .where('a.userId = :userId', { userId })
      // 프리미엄 일일 퀴즈 기록만. '복습' 버튼으로 푼 sentence_review는
      // 별도 동선이라 stats 오염 방지.
      .andWhere("(a.source IS NULL OR a.source = 'daily')");
    if (languageCode) {
      qb
        .innerJoin('s.language', 'l')
        .andWhere('l.code = :code', { code: languageCode });
    }

    switch (category) {
      case 'today':
        qb.andWhere("q.question ->> 'mode' IS NULL").andWhere(
          "NOT (q.question ? 'vocabId')",
        );
        break;
      case 'wordTyping':
        qb.andWhere("q.question ->> 'mode' = 'word_to_english'");
        break;
      case 'sentenceTyping':
        qb.andWhere("q.question ->> 'mode' = 'sentence_input'");
        break;
      case 'sentenceArrange':
        qb.andWhere("q.question ->> 'mode' = 'arrange'");
        break;
    }

    qb.orderBy('a.attemptedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [attempts, total] = await qb.getManyAndCount();

    return {
      items: attempts.map((a) => ({
        id: a.id,
        quizType: a.quiz.type,
        question: a.quiz.question,
        userAnswer: a.userAnswer,
        correctAnswer: a.quiz.answer,
        isCorrect: a.isCorrect,
        sentenceText: a.quiz.sentence?.text,
        attemptedAt: a.attemptedAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Daily sentence-listening quiz: user hears the full sentence read
   * aloud (client-side TTS) and types the word that's been blanked
   * out. Same FILL_BLANK shape as the regular daily quiz but with
   * `question.mode='listening'` and the hint/translation stripped, so
   * the audio is actually the primary cue.
   *
   * Sources: same recent-7-day assignments as `getDailyQuiz`. Dedup
   * by (sentenceId, mode='listening', today) so today's listening
   * pick is stable across reloads but rotates tomorrow.
   *
   * `question.fullSentence` is included for the client TTS call —
   * yes, it technically leaks the answer in network traffic, but
   * (a) we already accept the same trade-off in the word-listening
   * MC where `question.word` is visible, and (b) any real audio
   * solution would have to send the answer's text to the TTS engine
   * regardless.
   */
  async getDailySentenceListeningQuiz(
    userId: string,
    timezone = 'Asia/Seoul',
    languageCode?: string,
  ) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 최근 7일 assignment — 현재 학습 언어만.
    const dslQb = this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.sentence', 's')
      .where('a.userId = :userId', { userId })
      .andWhere('a.createdAt >= :since', { since: sevenDaysAgo });
    if (languageCode) {
      dslQb.innerJoin('s.language', 'l').andWhere('l.code = :code', {
        code: languageCode,
      });
    }
    const assignments = await dslQb.getMany();

    if (assignments.length === 0) {
      return { quizzes: [], total: 0 };
    }

    // distinct + random sample. 매 호출 다른 set.
    const distinctIds = Array.from(
      new Set(assignments.map((a) => a.sentenceId)),
    );
    const sampledIds = this.shuffleInPlace(distinctIds.slice()).slice(0, 10);
    const sentences = await this.sentenceRepo.find({
      where: { id: In(sampledIds) },
      relations: ['words'],
    });

    // user-tz today + AT TIME ZONE 변환 — UTC 자정~KST 자정 사이
    // 9시간 윈도에서 dedup miss / attemptedIds 누락 방지.
    const today = zonedDateString(new Date(), timezone);
    const quizzes: Quiz[] = [];

    for (const sentence of sentences) {
      const existing = await this.quizRepo
        .createQueryBuilder('q')
        .where('q.sentenceId = :sid', { sid: sentence.id })
        .andWhere('q.type = :type', { type: QuizType.FILL_BLANK })
        .andWhere("q.question ->> 'mode' = :mode", { mode: 'listening' })
        .andWhere(
          "DATE((q.createdAt AT TIME ZONE 'UTC') AT TIME ZONE :tz) = :today",
        )
        .setParameters({ tz: timezone, today })
        .getOne();
      if (existing) {
        quizzes.push(existing);
        continue;
      }
      const generated = await this.generateListeningFillBlank(sentence);
      if (generated) quizzes.push(generated);
    }

    // 오늘 맞힌 quiz 제외 + 오래된 학습 우선 ordering (ll_quiz_progress).
    // 결과 배열 자체를 ordering된 것으로 교체 — 이후 attemptIds 조회 +
    // map은 그 순서 그대로 활용.
    const orderedListening = await this.filterAndOrderByQuizProgress(
      quizzes,
      userId,
      timezone,
    );
    // priority로 정렬은 끝났고 표시는 랜덤.
    this.shuffleInPlace(orderedListening);
    quizzes.length = 0;
    quizzes.push(...orderedListening);

    // Same attempt-mark logic as getDailyQuiz so the client can grey
    // out already-tried items.
    const quizIds = quizzes.map((q) => q.id);
    const attempts = quizIds.length
      ? await this.attemptRepo
          .createQueryBuilder('a')
          .where('a.userId = :userId', { userId })
          .andWhere('a.quizId IN (:...quizIds)', { quizIds })
          .andWhere(
            "DATE((a.attemptedAt AT TIME ZONE 'UTC') AT TIME ZONE :tz) = :today",
          )
          .setParameters({ tz: timezone, today })
          .getMany()
      : [];
    const attemptedIds = new Set(attempts.map((a) => a.quizId));
    const sentenceById = new Map(sentences.map((s) => [s.id, s]));

    return {
      quizzes: quizzes.map((q) => {
        const s = sentenceById.get(q.sentenceId);
        return {
          id: q.id,
          type: q.type,
          sentenceId: q.sentenceId,
          question: q.question,
          isAttempted: attemptedIds.has(q.id),
          difficulty: s?.difficulty ?? null,
        };
      }),
      total: quizzes.length,
    };
  }

  /**
   * One-shot listening fill-blank generator. Mirrors the FILL_BLANK
   * branch in `generateQuizzesForSentence` but strips the visual
   * cues (hint, translation) and tags the question with `mode` +
   * `fullSentence` for client TTS. Returns null when the sentence
   * has no usable words to blank.
   */
  private async generateListeningFillBlank(
    sentence: Sentence,
  ): Promise<Quiz | null> {
    const words =
      sentence.words?.sort((a, b) => a.orderIndex - b.orderIndex) || [];
    if (words.length === 0) return null;

    const targetWord = words[Math.floor(Math.random() * words.length)];
    const blanked = sentence.text.replace(
      new RegExp(`\\b${this.escapeRegex(targetWord.word)}\\b`, 'i'),
      '______',
    );
    // Skip if word boundary regex didn't actually replace anything.
    if (blanked === sentence.text) return null;

    return this.quizRepo.save({
      sentenceId: sentence.id,
      type: QuizType.FILL_BLANK,
      question: {
        sentence: blanked,
        mode: 'listening',
        fullSentence: sentence.text,
      },
      answer: {
        word: targetWord.word,
        fullSentence: sentence.text,
      },
    });
  }

  private async generateQuizzesForSentence(
    sentence: Sentence,
  ): Promise<Quiz[]> {
    const words =
      sentence.words?.sort((a, b) => a.orderIndex - b.orderIndex) || [];
    const quizzes: Quiz[] = [];

    // 1. Fill in the blank (if sentence has words)
    if (words.length > 0) {
      const targetWord = words[Math.floor(Math.random() * words.length)];
      const blanked = sentence.text.replace(
        new RegExp(`\\b${this.escapeRegex(targetWord.word)}\\b`, 'i'),
        '______',
      );

      if (blanked !== sentence.text) {
        const quiz = await this.quizRepo.save({
          sentenceId: sentence.id,
          type: QuizType.FILL_BLANK,
          question: {
            sentence: blanked,
            hint: targetWord.meaning,
            translation: sentence.translation,
          },
          answer: {
            word: targetWord.word,
            fullSentence: sentence.text,
          },
        });
        quizzes.push(quiz);
      }
    }

    // 2. Word order
    const sentenceWords = sentence.text
      .replace(/[.,!?;:'"]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 0);

    if (sentenceWords.length >= 3) {
      const shuffled = [...sentenceWords].sort(() => Math.random() - 0.5);
      // Ensure shuffled is different from original
      if (shuffled.join(' ') === sentenceWords.join(' ')) {
        shuffled.reverse();
      }

      const quiz = await this.quizRepo.save({
        sentenceId: sentence.id,
        type: QuizType.WORD_ORDER,
        question: {
          words: shuffled,
          translation: sentence.translation,
        },
        answer: {
          correctOrder: sentenceWords,
          fullSentence: sentence.text,
        },
      });
      quizzes.push(quiz);
    }

    // 3. Translation (Korean → English)
    const translationQuiz = await this.quizRepo.save({
      sentenceId: sentence.id,
      type: QuizType.TRANSLATION,
      question: {
        translation: sentence.translation,
        situation: sentence.situation,
        difficulty: sentence.difficulty,
      },
      answer: {
        text: sentence.text,
        acceptableVariations: [sentence.text.toLowerCase()],
      },
    });
    quizzes.push(translationQuiz);

    // 4. Multiple choice (word meaning)
    if (words.length >= 1) {
      const targetWord = words[Math.floor(Math.random() * words.length)];

      // Get distractor meanings from other words in the DB
      const distractors = await this.wordRepo
        .createQueryBuilder('w')
        .where('w.sentenceId != :sentenceId', { sentenceId: sentence.id })
        .orderBy('RANDOM()')
        .take(3)
        .getMany();

      const options = [
        { text: targetWord.meaning, isCorrect: true },
        ...distractors.map((d) => ({ text: d.meaning, isCorrect: false })),
      ].sort(() => Math.random() - 0.5);

      if (options.length >= 2) {
        const quiz = await this.quizRepo.save({
          sentenceId: sentence.id,
          type: QuizType.MULTIPLE_CHOICE,
          question: {
            word: targetWord.word,
            context: sentence.text,
            options: options.map((o) => o.text),
          },
          answer: {
            correctIndex: options.findIndex((o) => o.isCorrect),
            correctMeaning: targetWord.meaning,
          },
        });
        quizzes.push(quiz);
      }
    }

    return quizzes;
  }

  /**
   * 매 quiz endpoint의 결과 배열을 정리:
   *   1) 오늘(user-tz 기준) 이미 맞춘 quiz 제외 — last_correct_at의
   *      local-date == today이면 빠짐. 틀린 것/한 번도 안 푼 것은 유지.
   *   2) 오래된 학습 우선 정렬 — last_correct_at NULLS FIRST + ASC.
   *      한 번도 안 맞춘 신규 quiz가 최우선(NULL 그룹 안에선 random
   *      shuffle), 그 다음 오래 전에 맞힌 것부터.
   *
   * 6개 quiz endpoint(daily/today/words/sentence 등)가 공통으로 호출.
   * 미세하게 다른 결과 type을 받으려고 generic `T extends { id: number }`.
   */
  /**
   * Fisher-Yates shuffle (uniform). JS Array.sort(() => Math.random()
   * - 0.5)는 comparator deterministic 가정 위반으로 V8에서 편향된
   * 결과 — 매 호출 random sample이 필요한 quiz pool에 부적합.
   */
  private shuffleInPlace<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private async filterAndOrderByQuizProgress<T extends { id: number }>(
    items: T[],
    userId: string,
    timezone: string,
  ): Promise<T[]> {
    if (items.length === 0) return items;
    const ids = items.map((q) => q.id);
    // select(col, alias) + addSelect(col, alias) 패턴 — TypeORM이
    // entity property를 DB column으로 자동 변환 (quiz_id snake_case)
    // 하면서 alias만 raw로 둠. 이전 ['p.quizId AS "quizId"', ...] 형태는
    // array select가 raw expression을 그대로 SELECT 절에 넣어 DB에
    // 없는 "quizId" 컬럼 참조 가능성.
    const rows = await this.quizProgressRepo
      .createQueryBuilder('p')
      .select('p.quizId', 'quizId')
      .addSelect('p.lastCorrectAt', 'lastCorrectAt')
      .where('p.userId = :userId', { userId })
      .andWhere('p.quizId IN (:...ids)', { ids })
      .getRawMany<{ quizId: number; lastCorrectAt: Date | null }>();
    const lastCorrectByQuiz = new Map<number, Date | null>();
    for (const r of rows) {
      lastCorrectByQuiz.set(
        Number(r.quizId),
        r.lastCorrectAt ? new Date(r.lastCorrectAt) : null,
      );
    }

    const today = zonedDateString(new Date(), timezone);
    // 1) filter
    const kept: T[] = [];
    for (const item of items) {
      const last = lastCorrectByQuiz.get(item.id);
      if (!last) {
        kept.push(item);
        continue;
      }
      const lastDay = zonedDateString(last, timezone);
      if (lastDay !== today) kept.push(item);
    }

    // 2) NULL(한 번도 안 맞힘) 먼저 + 그 안에서 shuffle. 그 다음
    //    last_correct_at 있는 것 ASC (오래된 것부터). 같은 timestamp
    //    이내 안정성은 굳이 보장 안 함.
    const neverCorrect: T[] = [];
    const everCorrect: T[] = [];
    for (const item of kept) {
      if (lastCorrectByQuiz.get(item.id)) everCorrect.push(item);
      else neverCorrect.push(item);
    }
    this.shuffleInPlace(neverCorrect);
    everCorrect.sort(
      (a, b) =>
        lastCorrectByQuiz.get(a.id)!.getTime() -
        lastCorrectByQuiz.get(b.id)!.getTime(),
    );
    return [...neverCorrect, ...everCorrect];
  }

  private checkAnswer(quiz: Quiz, userAnswer: Record<string, any>): boolean {
    switch (quiz.type) {
      case QuizType.FILL_BLANK: {
        // sentence_input mode compares the full sentence (whitespace +
        // punctuation normalised); everything else compares a single
        // word.
        const mode = quiz.question?.mode;
        if (mode === 'sentence_input') {
          const expected = (quiz.answer.sentence ??
            quiz.answer.fullSentence ??
            '') as string;
          const userText = (userAnswer.text ?? userAnswer.word ?? '') as string;
          return normaliseSentence(userText) === normaliseSentence(expected);
        }
        return (
          userAnswer.word?.toLowerCase().trim() ===
          quiz.answer.word?.toLowerCase().trim()
        );
      }

      case QuizType.WORD_ORDER: {
        const userOrder = (userAnswer.words as string[]) || [];
        const correctOrder = quiz.answer.correctOrder as string[];
        return (
          userOrder.length === correctOrder.length &&
          userOrder.every(
            (w, i) => w.toLowerCase() === correctOrder[i].toLowerCase(),
          )
        );
      }

      case QuizType.TRANSLATION: {
        const userText = (userAnswer.text || '').toString();
        const correctText = (quiz.answer.text || '').toString();
        const acceptable = (quiz.answer.acceptableVariations as string[]) ?? [];
        const targets = [correctText, ...acceptable];
        return targets.some((t) => translationMatches(userText, t));
      }

      case QuizType.MULTIPLE_CHOICE:
        return userAnswer.selectedIndex === quiz.answer.correctIndex;

      default:
        return false;
    }
  }

  private async updateProgress(
    userId: string,
    sentenceId: number,
    isCorrect: boolean,
  ) {
    let progress = await this.progressRepo.findOne({
      where: { userId, sentenceId },
    });

    if (!progress) {
      progress = this.progressRepo.create({
        userId,
        sentenceId,
        exposureCount: 1,
        quizAttempts: 0,
        quizCorrect: 0,
        masteryScore: 0,
      });
    }

    progress.quizAttempts += 1;
    if (isCorrect) {
      progress.quizCorrect += 1;
    }
    progress.lastQuizAt = new Date();

    // Calculate mastery score (0-100)
    const accuracy =
      progress.quizAttempts > 0
        ? progress.quizCorrect / progress.quizAttempts
        : 0;
    const exposureFactor = Math.min(progress.exposureCount / 5, 1);
    progress.masteryScore = Math.round(accuracy * 70 + exposureFactor * 30);

    await this.progressRepo.save(progress);
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * Visual hint for word typing — "h___" for "hand". Length cap at 8
 * so very long compounds don't reveal the full silhouette.
 */
function buildWordVisualHint(word: string): {
  length: number;
  firstLetter: string;
} {
  return {
    length: Math.min(word.length, 12),
    firstLetter: word.length > 0 ? word[0] : '',
  };
}

/**
 * Visual hint for sentence typing — keeps ~30% of the words visible
 * (deterministic by sentence text so the mask is stable across
 * re-fetches), masks the rest with `_`. Punctuation that's stuck to
 * a hidden word stays attached so the user can still see sentence
 * structure (`this.` → `_.`).
 */
function buildSentencePartialMask(sentence: string): string {
  const trimmed = sentence.trim();
  if (trimmed.length === 0) return '';
  // 공백 없는 스크립트(주로 JA/ZH) — word split이 1토큰만 만들어 힌트가
  // 문장 전체 노출로 무력화됨. 문자 단위 마스킹으로 fallback. 형태소 분석
  // 없이도 최소한의 hint 기능 확보. bunsetsu 단위 정확도는 미래 작업.
  if (!/\s/.test(trimmed)) {
    return buildCharLevelMask(trimmed);
  }
  // Split keeping leading/trailing punctuation grouped with the word.
  const tokens = trimmed.split(/\s+/);
  // 30% visible, rounded; at least 1, at most floor(N/2).
  const visibleCount = Math.max(
    1,
    Math.min(Math.floor(tokens.length / 2), Math.round(tokens.length * 0.3)),
  );
  // Deterministic shuffle so the mask doesn't change on retry/refresh
  // for the same sentence — the user shouldn't be able to game it by
  // re-rolling until they get an easier mask.
  const seed = hashStr(sentence);
  const indices = tokens
    .map((_, i) => i)
    .sort((a, b) => hashStr(`${seed}|${a}`) - hashStr(`${seed}|${b}`));
  const visibleSet = new Set(indices.slice(0, visibleCount));
  return tokens
    .map((tok, i) => {
      if (visibleSet.has(i)) return tok;
      // Preserve trailing punctuation: split into [word, punctTail].
      const m = tok.match(/^(.+?)([.,!?;:'"]+)$/);
      const wordPart = m ? m[1] : tok;
      const punctuation = m ? m[2] : '';
      const maskLength = Math.max(2, Math.min(wordPart.length, 12));
      return `${'_'.repeat(maskLength)}${punctuation}`;
    })
    .join(' ');
}

/**
 * 문자 단위 마스킹 — JA/ZH 같은 공백 없는 스크립트용. 구두점은 구조 단서
 * 라 항상 노출하고 나머지 글자 중 30%만 보이게. word-level과 동일하게
 * sentence-hash 시드로 결정적 셔플 — 재요청 시 마스크 동일.
 */
function buildCharLevelMask(sentence: string): string {
  const chars = Array.from(sentence); // surrogate pair 안전
  const eligibleIdx = chars
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !/[\p{P}\s]/u.test(c))
    .map(({ i }) => i);
  if (eligibleIdx.length === 0) return sentence;
  const visibleCount = Math.max(
    1,
    Math.min(
      Math.floor(eligibleIdx.length / 2),
      Math.round(eligibleIdx.length * 0.3),
    ),
  );
  const seed = hashStr(sentence);
  const shuffled = [...eligibleIdx].sort(
    (a, b) => hashStr(`${seed}|${a}`) - hashStr(`${seed}|${b}`),
  );
  const visibleSet = new Set(shuffled.slice(0, visibleCount));
  return chars
    .map((c, i) => {
      if (/[\p{P}\s]/u.test(c)) return c;
      return visibleSet.has(i) ? c : '_';
    })
    .join('');
}

/**
 * Normalise an English sentence for tolerant equality checks — fold
 * case, collapse whitespace, strip punctuation. Used by the
 * sentence_input mode so trailing periods or double spaces don't
 * mark a correct answer wrong.
 */
function normaliseSentence(s: string): string {
  // \p{P} 로 EN(., ?, ') + JA(。、？！「」 등) + 기타 Unicode 구두점을
  // 일괄 제거. 이전엔 ASCII 리스트만 있어 JA 사용자가 「これは本です。」를
  // 정답으로 입력해도 「。」 누락 시 오답으로 처리됐음.
  return s
    .toLowerCase()
    .replace(/\p{P}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** djb2-style hash — stable, fast, returns a non-negative integer
 *  small enough for a Date-keyed pseudo-shuffle. */
function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ────────────────────────────────────────────────────────────────
// translation grading helpers
// ────────────────────────────────────────────────────────────────

/** Common English contractions; expanded both directions so the user
 *  can type "don't" or "do not" interchangeably. */
type ContractionRule =
  | [RegExp, string]
  | [RegExp, (match: string, ...groups: string[]) => string];

const CONTRACTIONS: ContractionRule[] = [
  [/\b(it|that|what|there|who|how|where|when|here|let)['’]s\b/gi, '$1 is'],
  [/\b(i|you|we|they)['’]re\b/gi, '$1 are'],
  [/\b(i|you|he|she|we|they)['’]ve\b/gi, '$1 have'],
  [/\b(i|you|he|she|we|they)['’]ll\b/gi, '$1 will'],
  [/\b(i|you|he|she|we|they)['’]d\b/gi, '$1 would'],
  [
    /\b(do|does|did|is|are|was|were|has|have|had|can|could|should|would|will|won|might|must|need|dare|ought|ain)n['’]t\b/gi,
    (_m: string, v: string) =>
      v === 'won' ? 'will not' : v === 'ain' ? 'is not' : `${v} not`,
  ],
  [/\b([a-z]+)['’]m\b/gi, '$1 am'],
  [/\bcan['’]t\b/gi, 'cannot'],
  [/\bwon['’]t\b/gi, 'will not'],
  [/\bgonna\b/gi, 'going to'],
  [/\bwanna\b/gi, 'want to'],
];

function expandContractions(s: string): string {
  let out = s;
  for (const rule of CONTRACTIONS) {
    const [pattern, replacement] = rule;
    out =
      typeof replacement === 'string'
        ? out.replace(pattern, replacement)
        : out.replace(pattern, replacement as (...args: any[]) => string);
  }
  return out;
}

function normalizeForGrading(s: string): string {
  return (
    expandContractions(s)
      .toLowerCase()
      // Curly → straight apostrophes
      .replace(/['’]/g, "'")
      // Drop most punctuation; keep apostrophe for residual contractions
      .replace(/[.,!?;:"“”\-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Damerau-Levenshtein distance, capped — bail out once the edit
 *  count exceeds `cap` so we don't waste cycles on long mismatched
 *  sentences. */
function editDistance(a: string, b: string, cap: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const dp: number[] = Array(b.length + 1)
    .fill(0)
    .map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
      if (dp[j] < rowMin) rowMin = dp[j];
    }
    if (rowMin > cap) return cap + 1;
  }
  return dp[b.length];
}

/**
 * True if `userText` is "close enough" to `correctText` after
 * normalization. Tolerates short typos (Levenshtein up to ~5% of
 * length, min 1 max 3 chars) so a single missed key doesn't punish
 * an otherwise-correct answer.
 */
export function translationMatches(
  userText: string,
  correctText: string,
): boolean {
  const u = normalizeForGrading(userText);
  const c = normalizeForGrading(correctText);
  if (!u || !c) return false;
  if (u === c) return true;
  const cap = Math.min(3, Math.max(1, Math.floor(c.length * 0.05)));
  return editDistance(u, c, cap) <= cap;
}
