import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningProgress } from './learning-progress.entity.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { QuizAttempt } from '../quiz/quiz-attempt.entity.js';
import { Vocabulary } from '../vocabulary/vocabulary.entity.js';

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

function intervalDaysFor(mastery: number): number {
  return (
    REVIEW_INTERVALS.find((b) => mastery >= b.min)?.days ??
    REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1].days
  );
}

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(LearningProgress)
    private progressRepo: Repository<LearningProgress>,
    @InjectRepository(DailyAssignment)
    private assignmentRepo: Repository<DailyAssignment>,
    @InjectRepository(QuizAttempt)
    private attemptRepo: Repository<QuizAttempt>,
    @InjectRepository(Vocabulary)
    private vocabRepo: Repository<Vocabulary>,
  ) {}

  /**
   * Get overall learning stats for the user.
   */
  async getStats(userId: string) {
    // Total sentences learned
    const totalSentences = await this.assignmentRepo.count({
      where: { userId },
    });

    // Sentences completed (marked as completed)
    const completedSentences = await this.assignmentRepo.count({
      where: { userId, isCompleted: true },
    });

    // Current streak (consecutive days with assignments)
    const streak = await this.calculateStreak(userId);

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
      quizAccuracy: totalAttempts > 0
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
   */
  async getReviewQueue(userId: string, limit = 10) {
    const rows = await this.progressRepo.find({
      where: { userId },
      relations: ['sentence', 'sentence.words', 'sentence.grammarNotes'],
    });

    const now = Date.now();
    const due = rows
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
      .sort((a, b) => b.overdueMs - a.overdueMs)
      .slice(0, limit);

    return {
      total: due.length,
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
  async getAchievements(userId: string) {
    const stats = await this.getStats(userId);
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
        current: stats.totalSentences,
        target: 10,
      },
      {
        code: 'sentences_50',
        title: '문장 마스터',
        description: '문장 50개 학습',
        icon: 'auto_stories',
        current: stats.totalSentences,
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
        description: '퀴즈 정답률 80% 달성 (10회 이상)',
        icon: 'gps_fixed',
        current:
          stats.quizTotalAttempts >= 10 ? stats.quizAccuracy : 0,
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

    const achievements = defs.map((d) => {
      const progress = Math.min(d.current / d.target, 1);
      return {
        code: d.code,
        title: d.title,
        description: d.description,
        icon: d.icon,
        current: d.current,
        target: d.target,
        progress: Math.round(progress * 100) / 100,
        unlocked: d.current >= d.target,
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
  async getWeeklyReport(userId: string) {
    const days: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    const since = new Date(today);
    since.setDate(since.getDate() - 6);

    const assignments = await this.assignmentRepo
      .createQueryBuilder('a')
      .select('a.assignedDate', 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect(
        'SUM(CASE WHEN a.isCompleted THEN 1 ELSE 0 END)',
        'completed',
      )
      .where('a.userId = :userId', { userId })
      .andWhere('a.assignedDate >= :since', {
        since: since.toISOString().split('T')[0],
      })
      .groupBy('a.assignedDate')
      .getRawMany();

    const quizzes = await this.attemptRepo
      .createQueryBuilder('a')
      .select("to_char(a.attemptedAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'attempts')
      .addSelect('SUM(CASE WHEN a.isCorrect THEN 1 ELSE 0 END)', 'correct')
      .where('a.userId = :userId', { userId })
      .andWhere('a.attemptedAt >= :since', { since })
      .groupBy("to_char(a.attemptedAt, 'YYYY-MM-DD')")
      .getRawMany();

    const aMap = new Map(
      assignments.map((r) => [
        r.date,
        { count: parseInt(r.count), completed: parseInt(r.completed) },
      ]),
    );
    const qMap = new Map(
      quizzes.map((r) => [
        r.date,
        { attempts: parseInt(r.attempts), correct: parseInt(r.correct) },
      ]),
    );

    const daily = days.map((date) => ({
      date,
      sentences: aMap.get(date)?.count ?? 0,
      completed: aMap.get(date)?.completed ?? 0,
      quizAttempts: qMap.get(date)?.attempts ?? 0,
      quizCorrect: qMap.get(date)?.correct ?? 0,
    }));

    const vocabAdded = await this.vocabRepo
      .createQueryBuilder('v')
      .where('v.userId = :userId', { userId })
      .andWhere('v.createdAt >= :since', { since })
      .getCount();

    const totals = daily.reduce(
      (acc, d) => ({
        sentences: acc.sentences + d.sentences,
        completed: acc.completed + d.completed,
        quizAttempts: acc.quizAttempts + d.quizAttempts,
        quizCorrect: acc.quizCorrect + d.quizCorrect,
      }),
      { sentences: 0, completed: 0, quizAttempts: 0, quizCorrect: 0 },
    );

    return {
      from: days[0],
      to: days[days.length - 1],
      streak: await this.calculateStreak(userId),
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
    const accuracy = progress.quizAttempts > 0
      ? progress.quizCorrect / progress.quizAttempts
      : 0;
    const exposureFactor = Math.min(progress.exposureCount / 5, 1);
    progress.masteryScore = Math.round(accuracy * 70 + exposureFactor * 30);

    return this.progressRepo.save(progress);
  }

  private async calculateStreak(userId: string): Promise<number> {
    const assignments = await this.assignmentRepo
      .createQueryBuilder('a')
      .select('DISTINCT a.assignedDate', 'date')
      .where('a.userId = :userId', { userId })
      .orderBy('a.assignedDate', 'DESC')
      .getRawMany();

    if (assignments.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < assignments.length; i++) {
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);
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
