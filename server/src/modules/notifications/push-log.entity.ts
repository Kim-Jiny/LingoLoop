import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity.js';

@Entity('ll_push_logs')
export class PushLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ default: 'sentence' })
  pushType: string;

  @Column({ nullable: true })
  contentId: number;

  @Column({ default: 'sent' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  tappedAt: Date;

  @CreateDateColumn()
  sentAt: Date;
}
