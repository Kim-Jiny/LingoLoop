import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningProgress } from './learning-progress.entity.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { QuizAttempt } from '../quiz/quiz-attempt.entity.js';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(LearningProgress)
    private progressRepo: Repository<LearningProgress>,
    @InjectRepository(DailyAssignment)
    private assignmentRepo: Repository<DailyAssignment>,
    @InjectRepository(QuizAttempt)
    private attemptRepo: Repository<QuizAttempt>,
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
