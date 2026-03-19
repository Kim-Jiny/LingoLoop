import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity.js';

@Entity('ll_notification_settings')
export class NotificationSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ default: 60 })
  frequencyMinutes: number;

  @Column({ type: 'time', default: '09:00' })
  activeStartTime: string;

  @Column({ type: 'time', default: '22:00' })
  activeEndTime: string;

  @Column({ default: 'Asia/Seoul' })
  timezone: string;

  @Column({ type: 'float', default: 0.3 })
  quizPushRatio: number;

  @Column({ type: 'timestamp', nullable: true })
  nextPushAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
