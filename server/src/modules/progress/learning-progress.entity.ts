import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity.js';
import { Sentence } from '../sentences/sentence.entity.js';

@Entity('ll_learning_progress')
export class LearningProgress {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.progress)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Sentence)
  @JoinColumn({ name: 'sentence_id' })
  sentence: Sentence;

  @Column({ name: 'sentence_id' })
  sentenceId: number;

  @Column({ default: 0 })
  exposureCount: number;

  @Column({ default: 0 })
  quizAttempts: number;

  @Column({ default: 0 })
  quizCorrect: number;

  @Column({ type: 'float', default: 0 })
  masteryScore: number;

  @Column({ type: 'timestamp', nullable: true })
  lastExposedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastQuizAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
