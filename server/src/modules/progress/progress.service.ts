import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LearningProgress } from './learning-progress.entity.js';
import { AchievementUnlock } from './achievement-unlock.entity.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { QuizAttempt } from '../quiz/quiz-attempt.entity.js';
import { Vocabulary } from '../vocabulary/vocabulary.entity.js';
import {
  getZonedParts,
  zonedDateString,
  zonedWallToUtc,
} from '../../common/timezone.util.js';

/**
 * Spaced-repetition intervals (in days) keyed by mastery bucket. A sentence is
 * "due" once this many days have passed since it was last seen (exposure or
 * quiz). Higher mastery → longer interval, mirroring a forgetting curve.
 */
const REVIEW_INTERVALS: { min: number; days: number }[] = [
  { min: 85, days: 14 },
  { min: 70, days: 7 },
  { min: 50, days: 4 },
  { min: 30, days: 2 },
  { min: 0, days: 1 },
];

/**
 * Free users see at most this many sentences in the SRS review queue.
 * Premium is uncapped (within the requested `limit`). Three is the
 * smallest number that still feels like a real session — one or two
 * sentences read more like a teaser than a feature.
 */

function intervalDaysFor(mastery: number): number {
  return (
    REVIEW_INTERVALS.find((b) => mastery >= b.min)?.days ??
    REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1].days
  );
}

@Injectable()
export class ProgressService implements OnModuleInit {
  constructor(
    @InjectRepository(LearningProgress)
    private progressRepo: Repository<LearningProgress>,
    @InjectRepository(AchievementUnlock)
    private unlockRepo: Repository<AchievementUnlock>,
    @InjectRepository(DailyAssignment)
    private assignmentRepo: Repository<DailyAssignment>,
    @InjectRepository(QuizAttempt)
    private attemptRepo: Repository<QuizAttempt>,
    @InjectRepository(Vocabulary)
    private vocabRepo: Repository<Vocabulary>,
  ) {}

  async onModuleInit() {
    // synchronize off in prod — ensure achievement unlocks table
    // exists with the same shape as the entity. Failure to create is
    // fatal (entity columns wouldn't resolve), so we let it bubble.
    await this.progressRepo.query(`
      CREATE TABLE IF NOT EXISTS ll_achievement_unlocks (
        id serial PRIMARY KEY,
        user_id varchar NOT NULL,
        code varchar NOT NULL,
        unlocked_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT ll_achv_unlocks_user_code_uq UNIQUE (user_id, code)
      )
    `);
    await this.progressRepo.query(`
      CREATE INDEX IF NOT EXISTS ll_achv_unlocks_user_idx
        ON ll_achievement_unlocks (user_id)
    `);
  }

  /**
   * Get overall learning stats for the user.
   */
  async getStats(userId: string, timezone = 'Asia/Seoul') {
    // 전체 할당된 문장 수 (status 무관) — "받은 문장" 라벨에 대응.
    // 완료/스킵/진행 중 모두 포함해 사용자의 노출 범위 보여줌.
    const totalSentences = await this.assignmentRepo.count({
      where: { userId },
    });

    // 실제로 완료 처리한 문장만 — "완료 문장" 라벨에 대응.
    const completedSentences = await this.assignmentRepo.count({
      where: { userId, isCompleted: true },
    });

    // Current streak (consecutive days with assignments)
    const streak = await this.calculateStreak(userId, timezone);

    // Quiz stats
    const quizStats = await this.attemptRepo
      .createQueryBuilder('a')
      .select('COUNT(*)', 'totalAttempts')
      .addSelect('SUM(CASE WHEN a.isCorrect THEN 1 ELSE 0 END)', 'correctCount')
      .where('a.userId = :userId', { userId })
      .getRawOne();

    const totalAttempts = parseInt(quizStats?.totalAttempts || '0');
    const correctCount = parseInt(quizStats?.correctCount || '0');

    // Average mastery score
    const masteryResult = await this.progressRepo
      .createQueryBuilder('p')
      .select('AVG(p.masteryScore)', 'avgMastery')
      .where('p.userId = :userId', { userId })
      .andWhere('p.quizAttempts > 0')
      .getRawOne();

    const avgMastery = Math.round(parseFloat(masteryResult?.avgMastery || '0'));

    return {
      totalSentences,
      completedSentences,
      streak,
      quizTotalAttempts: totalAttempts,
      quizCorrectCount: correctCount,
      quizAccuracy:
        totalAttempts > 0
          ? Math.round((correctCount / totalAttempts) * 100)
          : 0,
      avgMasteryScore: avgMastery,
    };
  }

  /**
   * Get per-sentence progress details.
   */
  async getSentenceProgress(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.progressRepo.findAndCount({
      where: { userId },
      relations: ['sentence'],
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map((p) => ({
        sentenceId: p.sentenceId,
        sentenceText: p.sentence?.text,
        sentenceTranslation: p.sentence?.translation,
        exposureCount: p.exposureCount,
        quizAttempts: p.quizAttempts,
        quizCorrect: p.quizCorrect,
        masteryScore: p.masteryScore,
        lastExposedAt: p.lastExposedAt,
        lastQuizAt: p.lastQuizAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Spaced-repetition review queue: sentences the user has seen before whose
   * recall window has elapsed. Most overdue first.
   *
   * 무료/프리미엄 모두 동일한 `limit`까지 반환. 이전엔 무료는 3개로
   * 캡했는데 끝나고 다시 새로고침하면 또 3개 더 나와 사실상 의미 없는
   * 제한이라 풀었음. freeCapped/freeLimit 응답 필드는 클라 호환 위해
   * 항상 false/null로 유지.
   */
  async getReviewQueue(
    userId: string,
    _tier: 'free' | 'premium' = 'free',
    limit = 10,
  ) {
    const rows = await this.progressRepo.find({
      where: { userId },
      relations: ['sentence', 'sentence.words', 'sentence.grammarNotes'],
    });

    const now = Date.now();
    const allDue = rows
      .filter((p) => p.sentence?.isActive !== false && p.sentence)
      .map((p) => {
        const lastSeenAt = Math.max(
          p.lastExposedAt ? new Date(p.lastExposedAt).getTime() : 0,
          p.lastQuizAt ? new Date(p.lastQuizAt).getTime() : 0,
          new Date(p.updatedAt).getTime(),
        );
        const intervalMs = intervalDaysFor(p.masteryScore) * 86400000;
        const dueAt = lastSeenAt + intervalMs;
        const overdueMs = now - dueAt;
        return { p, overdueMs };
      })
      .filter((x) => x.overdueMs >= 0)
      .sort((a, b) => b.overdueMs - a.overdueMs);

    const totalDue = allDue.length;
    const due = allDue.slice(0, limit);

    return {
      total: totalDue,
      freeCapped: false,
      freeLimit: null,
      items: due.map(({ p, overdueMs }) => ({
        sentenceId: p.sentenceId,
        masteryScore: p.masteryScore,
        overdueDays: Math.floor(overdueMs / 86400000),
        sentence: {
          id: p.sentence.id,
          text: p.sentence.text,
          translation: p.sentence.translation,
          pronunciation: p.sentence.pronunciation,
          situation: p.sentence.situation,
          difficulty: p.sentence.difficulty,
          category: p.sentence.category,
          words: p.sentence.words
            ?.sort((a, b) => a.orderIndex - b.orderIndex)
            .map((w) => ({
              word: w.word,
              meaning: w.meaning,
              pronunciation: w.pronunciation,
              partOfSpeech: w.partOfSpeech,
              example: w.example,
            })),
          grammarNotes: p.sentence.grammarNotes
            ?.sort((a, b) => a.orderIndex - b.orderIndex)
            .map((g) => ({
              title: g.title,
              explanation: g.explanation,
              example: g.example,
            })),
        },
      })),
    };
  }

  /**
   * Derived achievement badges. No extra table — everything is computed from
   * existing learning data so it stays consistent with the rest of the app.
   */
  async getAchievements(userId: string, timezone = 'Asia/Seoul') {
    const stats = await this.getStats(userId, timezone);
    const vocabCount = await this.vocabRepo.count({ where: { userId } });

    const defs: {
      code: string;
      title: string;
      description: string;
      icon: string;
      current: number;
      target: number;
    }[] = [
      {
        code: 'first_step',
        title: '첫 발걸음',
        description: '첫 문장을 완료했어요',
        icon: 'flag',
        current: stats.completedSentences,
        target: 1,
      },
      {
        code: 'streak_3',
        title: '3일 루프',
        description: '3일 연속 학습',
        icon: 'local_fire_department',
        current: stats.streak,
        target: 3,
      },
      {
        code: 'streak_7',
        title: '일주일 루프',
        description: '7일 연속 학습',
        icon: 'local_fire_department',
        current: stats.streak,
        target: 7,
      },
      {
        code: 'streak_30',
        title: '한 달 루프',
        description: '30일 연속 학습',
        icon: 'whatshot',
        current: stats.streak,
        target: 30,
      },
      {
        code: 'sentences_10',
        title: '문장 수집가',
        description: '문장 10개 학습',
        icon: 'menu_book',
        // 완료된 문장 기준 — "학습"이라는 표현에 맞춤 (전체 받은
        // 수가 아닌 실제 완료 수).
        current: stats.completedSentences,
        target: 10,
      },
      {
        code: 'sentences_50',
        title: '문장 마스터',
        description: '문장 50개 학습',
        icon: 'auto_stories',
        current: stats.completedSentences,
        target: 50,
      },
      {
        code: 'quiz_sharp',
        title: '명사수',
        description: '퀴즈 정답 50개',
        icon: 'check_circle',
        current: stats.quizCorrectCount,
        target: 50,
      },
      {
        code: 'quiz_accuracy',
        title: '정확도 80%',
        description: '퀴즈 10회 이상 시도 + 정답률 80%',
        icon: 'gps_fixed',
        // 2단계 진행도: 10회 시도 전엔 attempts/10 진행률, 도달 후엔
        // accuracy/80. 이전엔 attempts<10일 때 current=0이라 사용자가
        // "왜 0%지?" 혼란.
        current:
          stats.quizTotalAttempts >= 10
            ? stats.quizAccuracy
            : Math.min(stats.quizTotalAttempts * 8, 79), // 10회=80에 못 미치게 79까지만
        target: 80,
      },
      {
        code: 'collector_20',
        title: '단어 수집가',
        description: '단어장에 20개 저장',
        icon: 'bookmark',
        current: vocabCount,
        target: 20,
      },
    ];

    // 영구 sticky: 한 번이라도 달성했던 기록을 가져와서, 현재 상태가
    // 떨어져도 unlocked 유지. 첫 달성 시점에 INSERT (UNIQUE 제약으로
    // 두 번째 호출부터는 no-op).
    const existingUnlocks = await this.unlockRepo.find({
      where: { userId, code: In(defs.map((d) => d.code)) },
    });
    const unlockedSet = new Set(existingUnlocks.map((u) => u.code));

    const newlyUnlocked: AchievementUnlock[] = [];
    for (const d of defs) {
      const everUnlocked = unlockedSet.has(d.code);
      const currentlyMet = d.current >= d.target;
      if (currentlyMet && !everUnlocked) {
        newlyUnlocked.push(this.unlockRepo.create({ userId, code: d.code }));
        unlockedSet.add(d.code);
      }
    }
    if (newlyUnlocked.length > 0) {
      // ignore-on-conflict로 동시 호출에서도 안전.
      try {
        await this.unlockRepo.insert(newlyUnlocked);
      } catch {
        // 동시 두 번째 요청이 UNIQUE 충돌 → 이미 sticky 처리됨, 무시.
      }
    }

    const achievements = defs.map((d) => {
      const sticky = unlockedSet.has(d.code);
      // unlocked 상태일 때 progress는 1.0 (시각적 만족).
      // 그렇지 않으면 current/target.
      const progress = sticky ? 1 : Math.min(d.current / d.target, 1);
      return {
        code: d.code,
        title: d.title,
        description: d.description,
        icon: d.icon,
        current: d.current,
        target: d.target,
        progress: Math.round(progress * 100) / 100,
        unlocked: sticky,
      };
    });

    return {
      unlockedCount: achievements.filter((a) => a.unlocked).length,
      total: achievements.length,
      achievements,
    };
  }

  /**
   * Last 7-day learning report (per-day breakdown + totals).
   */
  async getWeeklyReport(userId: string, timezone = 'Asia/Seoul') {
    const days: string[] = [];
    const now = new Date();
    const z = getZonedParts(now, timezone);
    const today = new Date(Date.UTC(z.year, z.month - 1, z.day));
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    const since = new Date(today);
    since.setUTCDate(since.getUTCDate() - 6);
    const sinceInstant = zonedWallToUtc(
      Number(days[0].slice(0, 4)),
      Number(days[0].slice(5, 7)),
      Number(days[0].slice(8, 10)),
      0,
      0,
      timezone,
    );

    // Bucket completions by the local day they were *finished* on,
    // not the day they were scheduled — same reasoning as the
    // heatmap. Two-step AT TIME ZONE: tag UTC, convert to user tz.
    const localCompletedDateExpr =
      "to_char((a.completedAt AT TIME ZONE 'UTC') AT TIME ZONE :asnTimezone, 'YYYY-MM-DD')";
    const assignments = await this.assignmentRepo
      .createQueryBuilder('a')
      .select(localCompletedDateExpr, 'date')
      // 이미 status='completed'로 필터된 결과이므로 별도 'completed'
      // SUM이 필요 없음 — count == completed가 항상 성립.
      .addSelect('COUNT(*)', 'count')
      .where('a.userId = :userId', { userId })
      .andWhere("a.status = 'completed'")
      .andWhere('a.completedAt IS NOT NULL')
      .andWhere('a.completedAt >= :asnSince', { asnSince: sinceInstant })
      .groupBy(localCompletedDateExpr)
      .setParameter('asnTimezone', timezone)
      .getRawMany();

    // attemptedAt is `timestamp without time zone` storing the UTC wall
    // clock. Tag as UTC first, then convert to the user's zone — a single
    // `AT TIME ZONE :tz` would be the wrong direction for a naive column.
    const localDateExpr =
      "to_char((a.attemptedAt AT TIME ZONE 'UTC') AT TIME ZONE :timezone, 'YYYY-MM-DD')";
    const quizzes = await this.attemptRepo
      .createQueryBuilder('a')
      .select(localDateExpr, 'date')
      .addSelect('COUNT(*)', 'attempts')
      .addSelect('SUM(CASE WHEN a.isCorrect THEN 1 ELSE 0 END)', 'correct')
      .where('a.userId = :userId', { userId })
      .andWhere('a.attemptedAt >= :since', { since: sinceInstant })
      .groupBy(localDateExpr)
      .setParameter('timezone', timezone)
      .getRawMany();

    const aMap = new Map(assignments.map((r) => [r.date, parseInt(r.count)]));
    const qMap = new Map(
      quizzes.map((r) => [
        r.date,
        { attempts: parseInt(r.attempts), correct: parseInt(r.correct) },
      ]),
    );

    const daily = days.map((date) => ({
      date,
      // 쿼리가 status='completed' 필터 → 완료 문장 수.
      sentences: aMap.get(date) ?? 0,
      quizAttempts: qMap.get(date)?.attempts ?? 0,
      quizCorrect: qMap.get(date)?.correct ?? 0,
    }));

    const vocabAdded = await this.vocabRepo
      .createQueryBuilder('v')
      .where('v.userId = :userId', { userId })
      .andWhere('v.createdAt >= :since', { since: sinceInstant })
      .getCount();

    const totals = daily.reduce(
      (acc, d) => ({
        sentences: acc.sentences + d.sentences,
        quizAttempts: acc.quizAttempts + d.quizAttempts,
        quizCorrect: acc.quizCorrect + d.quizCorrect,
      }),
      { sentences: 0, quizAttempts: 0, quizCorrect: 0 },
    );

    return {
      from: days[0],
      to: days[days.length - 1],
      streak: await this.calculateStreak(userId, timezone),
      vocabAdded,
      totals: {
        ...totals,
        quizAccuracy:
          totals.quizAttempts > 0
            ? Math.round((totals.quizCorrect / totals.quizAttempts) * 100)
            : 0,
        activeDays: daily.filter((d) => d.sentences > 0 || d.quizAttempts > 0)
          .length,
      },
      daily,
    };
  }

  /**
   * Daily completed-sentence counts for a heatmap, plus the user's goal
   * and today's count. "Today" is the user's local day.
   */
  async getHeatmap(
    userId: string,
    timezone = 'Asia/Seoul',
    dailyGoal = 3,
    days = 120,
  ) {
    const z = getZonedParts(new Date(), timezone);
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${z.year}-${pad(z.month)}-${pad(z.day)}`;
    const sinceDate = new Date(Date.UTC(z.year, z.month - 1, z.day));
    sinceDate.setUTCDate(sinceDate.getUTCDate() - (days - 1));
    const since = sinceDate.toISOString().split('T')[0];
    // UTC instant of the user's local since-midnight, for filtering
    // a `timestamp without time zone` column. (assignedDate is a date,
    // but completedAt is a timestamp — we filter on the timestamp.)
    const sinceInstant = zonedWallToUtc(
      Number(since.slice(0, 4)),
      Number(since.slice(5, 7)),
      Number(since.slice(8, 10)),
      0,
      0,
      timezone,
    );

    // Bucket by the day the user actually finished the sentence (in
    // their local zone), not the day the assignment was scheduled.
    // Same two-step AT TIME ZONE pattern as the weekly report —
    // tag the naive UTC timestamp as UTC, convert to the user's
    // zone, then format as YYYY-MM-DD.
    const localDateExpr =
      "to_char((a.completedAt AT TIME ZONE 'UTC') AT TIME ZONE :timezone, 'YYYY-MM-DD')";
    const rows = await this.assignmentRepo
      .createQueryBuilder('a')
      .select(localDateExpr, 'date')
      .addSelect('COUNT(*)', 'count')
      .where('a.userId = :userId', { userId })
      .andWhere("a.status = 'completed'")
      .andWhere('a.completedAt IS NOT NULL')
      .andWhere('a.completedAt >= :since', { since: sinceInstant })
      .groupBy(localDateExpr)
      .setParameter('timezone', timezone)
      .getRawMany();

    const items = rows.map((r) => ({
      date: String(r.date).slice(0, 10),
      count: parseInt(r.count, 10),
    }));
    const todayCount = items.find((i) => i.date === today)?.count ?? 0;

    // [DEBUG] 임시 — 오늘 데이터 누락 원인 파악용 로깅. 추후 제거.
    // eslint-disable-next-line no-console
    console.log(
      '[heatmap]',
      JSON.stringify({
        userId,
        timezone,
        today,
        sinceInstant: sinceInstant?.toISOString?.(),
        rawRows: rows,
        items,
        todayCount,
      }),
    );

    return { goal: dailyGoal, todayCount, today, since, items };
  }

  /**
   * Record that a user has been exposed to a sentence (viewed it).
   */
  async recordExposure(userId: string, sentenceId: number) {
    let progress = await this.progressRepo.findOne({
      where: { userId, sentenceId },
    });

    if (!progress) {
      progress = this.progressRepo.create({
        userId,
        sentenceId,
        exposureCount: 0,
        quizAttempts: 0,
        quizCorrect: 0,
        masteryScore: 0,
      });
    }

    progress.exposureCount += 1;
    progress.lastExposedAt = new Date();

    // Recalculate mastery
    const accuracy =
      progress.quizAttempts > 0
        ? progress.quizCorrect / progress.quizAttempts
        : 0;
    const exposureFactor = Math.min(progress.exposureCount / 5, 1);
    progress.masteryScore = Math.round(accuracy * 70 + exposureFactor * 30);

    return this.progressRepo.save(progress);
  }

  private async calculateStreak(
    userId: string,
    timezone = 'Asia/Seoul',
  ): Promise<number> {
    // Streak counts consecutive days the user actually completed
    // something. Use the local completion date — completing yesterday's
    // assignment today should count toward today's streak, not break it.
    const streakDateExpr =
      "to_char((a.completedAt AT TIME ZONE 'UTC') AT TIME ZONE :strTimezone, 'YYYY-MM-DD')";
    const assignments = await this.assignmentRepo
      .createQueryBuilder('a')
      .select(`DISTINCT ${streakDateExpr}`, 'date')
      .where('a.userId = :userId', { userId })
      .andWhere("a.status = 'completed'")
      .andWhere('a.completedAt IS NOT NULL')
      .orderBy('date', 'DESC')
      .setParameter('strTimezone', timezone)
      .getRawMany();

    if (assignments.length === 0) return 0;

    const today = zonedDateString(new Date(), timezone);
    const todayDate = new Date(`${today}T00:00:00.000Z`);
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    // Streak grace: today might not be done yet (user hasn't opened the
    // app yet today). If the most-recent completion is yesterday, start
    // counting from yesterday — the streak is still live, the user just
    // hasn't completed *today* yet. Only treat as broken when the most
    // recent completion is older than yesterday.
    const mostRecent = assignments[0].date;
    if (mostRecent !== today && mostRecent !== yesterday) return 0;

    let streak = 0;
    const cursor = new Date(`${mostRecent}T00:00:00.000Z`);

    for (let i = 0; i < assignments.length; i++) {
      const expectedDate = new Date(cursor);
      expectedDate.setUTCDate(expectedDate.getUTCDate() - i);
      const expected = expectedDate.toISOString().split('T')[0];

      if (assignments[i].date === expected) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }
}
