import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Quiz, QuizType } from './quiz.entity.js';
import { QuizAttempt } from './quiz-attempt.entity.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { Sentence } from '../sentences/sentence.entity.js';
import { Word } from '../sentences/word.entity.js';
import { LearningProgress } from '../progress/learning-progress.entity.js';

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

    return {
      quizzes: shuffled.map((q) => ({
        id: q.id,
        type: q.type,
        sentenceId: q.sentenceId,
        question: q.question,
        isAttempted: attemptedIds.has(q.id),
      })),
      total: shuffled.length,
    };
  }

  /**
   * Submit a quiz answer and return result.
   */
  async submitAnswer(userId: string, quizId: number, userAnswer: Record<string, any>) {
    const quiz = await this.quizRepo.findOne({
      where: { id: quizId },
      relations: ['sentence'],
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
      explanation: quiz.question.explanation || null,
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
      case QuizType.FILL_BLANK:
        return (
          userAnswer.word?.toLowerCase().trim() ===
          quiz.answer.word?.toLowerCase().trim()
        );

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
        const userText = (userAnswer.text || '').toLowerCase().trim();
        const correctText = (quiz.answer.text || '').toLowerCase().trim();
        // Exact match or close enough (remove punctuation)
        const normalize = (s: string) =>
          s.replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ').trim();
        return normalize(userText) === normalize(correctText);
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
