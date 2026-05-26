import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Quiz, QuizType } from './quiz.entity.js';
import { QuizAttempt } from './quiz-attempt.entity.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { Sentence } from '../sentences/sentence.entity.js';
import { Word } from '../sentences/word.entity.js';
import { LearningProgress } from '../progress/learning-progress.entity.js';
import { Vocabulary } from '../vocabulary/vocabulary.entity.js';

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(Quiz)
    private quizRepo: Repository<Quiz>,
    @InjectRepository(QuizAttempt)
    private attemptRepo: Repository<QuizAttempt>,
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
  ) {}

  /**
   * Get daily quiz set for user.
   * Generates quizzes from recently learned sentences (last 7 days).
   * Returns up to 10 quiz questions.
   */
  async getDailyQuiz(userId: string) {
    // Get sentences assigned in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const assignments = await this.assignmentRepo
      .createQueryBuilder('a')
      .where('a.userId = :userId', { userId })
      .andWhere('a.createdAt >= :since', { since: sevenDaysAgo })
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

    // Generate quizzes for each sentence (avoid duplicates today)
    const today = new Date().toISOString().split('T')[0];
    const quizzes: Quiz[] = [];

    for (const sentence of sentences) {
      // Check if quizzes already generated today for this sentence
      const existing = await this.quizRepo
        .createQueryBuilder('q')
        .where('q.sentenceId = :sentenceId', { sentenceId: sentence.id })
        .andWhere('DATE(q.createdAt) = :today', { today })
        .getMany();

      if (existing.length > 0) {
        quizzes.push(...existing);
        continue;
      }

      const generated = await this.generateQuizzesForSentence(sentence);
      quizzes.push(...generated);
    }

    // Shuffle and limit to 10
    const shuffled = quizzes.sort(() => Math.random() - 0.5).slice(0, 10);

    // Check which ones user already attempted today
    const quizIds = shuffled.map((q) => q.id);
    const attempts =
      quizIds.length > 0
        ? await this.attemptRepo
            .createQueryBuilder('a')
            .where('a.userId = :userId', { userId })
            .andWhere('a.quizId IN (:...quizIds)', { quizIds })
            .andWhere('DATE(a.attemptedAt) = :today', { today })
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
  async getTodayQuiz(userId: string) {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000);
    const yyyymmdd = (d: Date) => d.toISOString().split('T')[0];
    const dateRange = [yyyymmdd(yesterday), yyyymmdd(today)];

    const assignments = await this.assignmentRepo
      .createQueryBuilder('a')
      .where('a.userId = :userId', { userId })
      .andWhere('a.assignedDate IN (:...dates)', { dates: dateRange })
      .andWhere('a.status IN (:...statuses)', {
        statuses: ['active', 'completed'],
      })
      .orderBy('a.createdAt', 'DESC')
      .getMany();

    if (assignments.length === 0) return { quizzes: [], total: 0 };

    const sentenceIds = assignments.map((a) => a.sentenceId);
    const sentences = await this.sentenceRepo.find({
      where: { id: In(sentenceIds) },
      relations: ['words'],
    });

    const todayStr = yyyymmdd(today);
    const allQuizzes: Quiz[] = [];

    for (const sentence of sentences) {
      const existing = await this.quizRepo
        .createQueryBuilder('q')
        .where('q.sentenceId = :sid', { sid: sentence.id })
        .andWhere('DATE(q.createdAt) = :today', { today: todayStr })
        .getMany();
      if (existing.length > 0) {
        allQuizzes.push(...existing);
        continue;
      }
      allQuizzes.push(...(await this.generateQuizzesForSentence(sentence)));
    }

    // Limit to 10 with deterministic-ish shuffle.
    const shuffled = allQuizzes.sort(() => Math.random() - 0.5).slice(0, 10);
    const quizIds = shuffled.map((q) => q.id);
    const attempts = quizIds.length
      ? await this.attemptRepo
          .createQueryBuilder('a')
          .where('a.userId = :userId', { userId })
          .andWhere('a.quizId IN (:...quizIds)', { quizIds })
          .andWhere('DATE(a.attemptedAt) = :today', { today: todayStr })
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
  async getWordTypingQuiz(userId: string, status: 'learning' | 'learned') {
    const vocab = await this.vocabRepo
      .createQueryBuilder('v')
      .where('v.userId = :userId', { userId })
      .andWhere('v.status = :status', { status })
      .andWhere("v.meaning IS NOT NULL AND v.meaning <> ''")
      .orderBy('v.createdAt', 'DESC')
      .take(40)
      .getMany();

    if (vocab.length === 0) return { quizzes: [], total: 0 };

    const today = new Date().toISOString().split('T')[0];
    const seed = hashStr(`${userId}|${today}|${status}`);
    const pool = vocab.slice().sort((a, b) =>
      hashStr(`${seed}|${a.id}`) - hashStr(`${seed}|${b.id}`),
    );
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
      const sourceSentence = v.sentenceId ? sentenceMap.get(v.sentenceId) : null;
      if (!sourceSentence) continue;

      // Dedupe per (vocab + mode + day) so reopening the tab doesn't
      // create duplicate Quiz rows.
      const existing = await this.quizRepo
        .createQueryBuilder('q')
        .where('q.sentenceId = :sid', { sid: sourceSentence.id })
        .andWhere('q.type = :type', { type: QuizType.FILL_BLANK })
        .andWhere("q.question ->> 'vocabId' = :vid", { vid: String(v.id) })
        .andWhere("q.question ->> 'mode' = :mode", { mode: 'word_to_english' })
        .andWhere('DATE(q.createdAt) = :today', { today })
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

    return { quizzes, total: quizzes.length };
  }

  /**
   * "문장퀴즈" — random monthly completed sentence, user types the
   * full English from a Korean translation prompt. Hints: 듣기
   * (full sentence TTS) + 보기 (~30% of words pre-filled, the rest
   * masked with `_`). Both hints can be active simultaneously on the
   * client.
   */
  async getSentenceTypingQuiz(userId: string) {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    // Completed-this-month, dedup by sentence so we don't ask the
    // same sentence twice. Take up to 30 candidates so the deterministic
    // shuffle has room to pick a variety.
    const rows = await this.assignmentRepo
      .createQueryBuilder('a')
      .select('DISTINCT a.sentenceId', 'sid')
      .where('a.userId = :userId', { userId })
      .andWhere("a.status = 'completed'")
      .andWhere('a.completedAt IS NOT NULL')
      .andWhere('a.completedAt >= :since', { since: monthStart })
      .limit(30)
      .getRawMany();
    const candidateIds = rows
      .map((r) => Number(r.sid))
      .filter((n) => !Number.isNaN(n));
    if (candidateIds.length === 0) return { quizzes: [], total: 0 };

    const today = new Date().toISOString().split('T')[0];
    const seed = hashStr(`${userId}|${today}|sentence_typing`);
    const ordered = candidateIds.slice().sort(
      (a, b) => hashStr(`${seed}|${a}`) - hashStr(`${seed}|${b}`),
    );
    const pickedIds = ordered.slice(0, 10);

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
        .andWhere('DATE(q.createdAt) = :today', { today })
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

    return { quizzes, total: quizzes.length };
  }

  /**
   * Submit a quiz answer and return result.
   */
  async submitAnswer(userId: string, quizId: number, userAnswer: Record<string, any>) {
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
  ) {
    const vocab = await this.vocabRepo
      .createQueryBuilder('v')
      .where('v.userId = :userId', { userId })
      .andWhere("v.status = 'learning'")
      .andWhere('v.meaning IS NOT NULL AND v.meaning <> :empty', { empty: '' })
      .orderBy('v.createdAt', 'DESC')
      .take(40) // pool to rotate from
      .getMany();

    if (vocab.length === 0) {
      return { quizzes: [], total: 0 };
    }

    // Deterministic shuffle by date so the user gets a stable set
    // for the day, but a different set tomorrow.
    const today = new Date().toISOString().split('T')[0];
    const seed = hashStr(`${userId}|${today}`);
    const pool = vocab.slice().sort((a, b) => {
      // hash(seed + id) gives stable pseudo-random order
      return (
        hashStr(`${seed}|${a.id}`) - hashStr(`${seed}|${b.id}`)
      );
    });
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
    let distractorPool = distinctUserMeanings;
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
        .andWhere(
          "COALESCE(q.question ->> 'mode', 'normal') = :mode",
          { mode },
        )
        .andWhere('DATE(q.createdAt) = :today', { today: today2 })
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
            ...(isListening
              ? { mode: 'listening', fullSentence: v.word }
              : {}),
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

    return { quizzes, total: quizzes.length };
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
  async getReviewQueue(userId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // All recent attempts joined to quiz + sentence so we can rank.
    const attempts = await this.attemptRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.quiz', 'q')
      .where('a.userId = :userId', { userId })
      .andWhere('a.attemptedAt >= :since', { since: thirtyDaysAgo })
      .orderBy('a.attemptedAt', 'DESC')
      .getMany();

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

    return {
      quizzes: candidates
        .map((c) => quizById.get(c.quizId))
        .filter((q): q is Quiz => !!q)
        .map((q) => ({
          id: q.id,
          type: q.type,
          sentenceId: q.sentenceId,
          question: q.question,
          difficulty: q.sentence?.difficulty ?? null,
          isAttempted: false, // we WANT them to attempt again
        })),
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
  async getProgress(userId: string) {
    // Join progress → sentences to pivot mastery by difficulty.
    // Raw query because the aggregation crosses a 1:1 relation and
    // TypeORM's QB API for this is more code than the SQL.
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
        GROUP BY s.difficulty`,
      [userId],
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
   * Get quiz history for user.
   */
  async getHistory(userId: string, page = 1, limit = 20) {
    const [attempts, total] = await this.attemptRepo.findAndCount({
      where: { userId },
      relations: ['quiz', 'quiz.sentence'],
      order: { attemptedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

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
  async getDailySentenceListeningQuiz(userId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const assignments = await this.assignmentRepo
      .createQueryBuilder('a')
      .where('a.userId = :userId', { userId })
      .andWhere('a.createdAt >= :since', { since: sevenDaysAgo })
      .orderBy('a.createdAt', 'DESC')
      .take(10)
      .getMany();

    if (assignments.length === 0) {
      return { quizzes: [], total: 0 };
    }

    const sentenceIds = assignments.map((a) => a.sentenceId);
    const sentences = await this.sentenceRepo.find({
      where: { id: In(sentenceIds) },
      relations: ['words'],
    });

    const today = new Date().toISOString().split('T')[0];
    const quizzes: Quiz[] = [];

    for (const sentence of sentences) {
      const existing = await this.quizRepo
        .createQueryBuilder('q')
        .where('q.sentenceId = :sid', { sid: sentence.id })
        .andWhere('q.type = :type', { type: QuizType.FILL_BLANK })
        .andWhere("q.question ->> 'mode' = :mode", { mode: 'listening' })
        .andWhere('DATE(q.createdAt) = :today', { today })
        .getOne();
      if (existing) {
        quizzes.push(existing);
        continue;
      }
      const generated = await this.generateListeningFillBlank(sentence);
      if (generated) quizzes.push(generated);
    }

    // Same attempt-mark logic as getDailyQuiz so the client can grey
    // out already-tried items.
    const quizIds = quizzes.map((q) => q.id);
    const attempts = quizIds.length
      ? await this.attemptRepo
          .createQueryBuilder('a')
          .where('a.userId = :userId', { userId })
          .andWhere('a.quizId IN (:...quizIds)', { quizIds })
          .andWhere('DATE(a.attemptedAt) = :today', { today })
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

  private async generateQuizzesForSentence(sentence: Sentence): Promise<Quiz[]> {
    const words = sentence.words?.sort((a, b) => a.orderIndex - b.orderIndex) || [];
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

  private checkAnswer(quiz: Quiz, userAnswer: Record<string, any>): boolean {
    switch (quiz.type) {
      case QuizType.FILL_BLANK: {
        // sentence_input mode compares the full sentence (whitespace +
        // punctuation normalised); everything else compares a single
        // word.
        const mode = quiz.question?.mode;
        if (mode === 'sentence_input') {
          const expected = (quiz.answer.sentence ?? quiz.answer.fullSentence ?? '') as string;
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
function buildWordVisualHint(word: string): { length: number; firstLetter: string } {
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
  // Split keeping leading/trailing punctuation grouped with the word.
  const tokens = sentence.trim().split(/\s+/);
  if (tokens.length === 0) return '';
  // 30% visible, rounded; at least 1, at most floor(N/2).
  const visibleCount = Math.max(
    1,
    Math.min(Math.floor(tokens.length / 2), Math.round(tokens.length * 0.3)),
  );
  // Deterministic shuffle so the mask doesn't change on retry/refresh
  // for the same sentence — the user shouldn't be able to game it by
  // re-rolling until they get an easier mask.
  const seed = hashStr(sentence);
  const indices = tokens.map((_, i) => i).sort(
    (a, b) => hashStr(`${seed}|${a}`) - hashStr(`${seed}|${b}`),
  );
  const visibleSet = new Set(indices.slice(0, visibleCount));
  return tokens
    .map((tok, i) => {
      if (visibleSet.has(i)) return tok;
      // Preserve trailing punctuation: split into [word, punctTail].
      const m = tok.match(/^(.+?)([.,!?;:'"]+)$/);
      return m ? `_${m[2]}` : '_';
    })
    .join(' ');
}

/**
 * Normalise an English sentence for tolerant equality checks — fold
 * case, collapse whitespace, strip punctuation. Used by the
 * sentence_input mode so trailing periods or double spaces don't
 * mark a correct answer wrong.
 */
function normaliseSentence(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:'"’]/g, '')
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
  return expandContractions(s)
    .toLowerCase()
    // Curly → straight apostrophes
    .replace(/['’]/g, "'")
    // Drop most punctuation; keep apostrophe for residual contractions
    .replace(/[.,!?;:"“”\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
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
