import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity.js';
import { Quiz } from './quiz.entity.js';

@Entity('ll_quiz_attempts')
export class QuizAttempt {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Quiz, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: Quiz;

  @Column({ name: 'quiz_id' })
  quizId: number;

  @Column({ type: 'jsonb' })
  userAnswer: Record<string, any>;

  @Column()
  isCorrect: boolean;

  /// 'daily' = 프리미엄 일일 퀴즈 (기본), 'sentence_review' = 오늘 문장
  /// 카드의 '복습' 버튼으로 들어온 per-sentence 4문제. 분리해서 stats
  /// 오염 방지 — getHistory/getProgress는 'daily'만 집계.
  @Column({ type: 'varchar', default: 'daily' })
  source: string;

  @CreateDateColumn()
  attemptedAt: Date;
}
