import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity.js';
import { Sentence } from './sentence.entity.js';

// No (user, date) unique constraint: a user can take more than one
// sentence per day by completing or skipping.
@Entity('ll_daily_assignments')
export class DailyAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.dailyAssignments)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Sentence)
  @JoinColumn({ name: 'sentence_id' })
  sentence: Sentence;

  @Column({ name: 'sentence_id' })
  sentenceId: number;

  @Column({ type: 'date' })
  assignedDate: string;

  @Column({ default: false })
  isCompleted: boolean;

  // 'active' (current) | 'completed' (learned → review pool) | 'skipped'
  // (can be served again later).
  @Column({ default: 'active' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
