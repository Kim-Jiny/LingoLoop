import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity.js';
import { Sentence } from './sentence.entity.js';

@Entity('ll_daily_assignments')
@Unique(['user', 'assignedDate'])
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

  @CreateDateColumn()
  createdAt: Date;
}
