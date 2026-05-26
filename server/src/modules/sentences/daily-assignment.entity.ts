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

  /**
   * Wall-clock instant the user actually finished this assignment.
   * Distinct from `createdAt` (= when they were given the sentence)
   * and `assignedDate` (= the same day, in user-local form). Drives
   * the heatmap, weekly report, and streak so multi-day learners
   * don't get bucketed under the day the assignment was scheduled.
   *
   * Backfilled to createdAt for legacy completed rows so historical
   * counts don't disappear after the migration.
   */
  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
