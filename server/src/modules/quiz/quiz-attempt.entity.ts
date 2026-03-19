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

  @CreateDateColumn()
  attemptedAt: Date;
}
