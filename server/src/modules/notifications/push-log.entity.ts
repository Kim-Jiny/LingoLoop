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

  /**
   * 보낸 알림의 실제 title/body. 운영자가 backstage 푸시 히스토리에서
   * "어떤 내용이 갔는지" 확인하고, 사용자 문의 시 'X 내용 푸시가 왔는데
   * 뭐였냐'에 답할 근거가 됨.
   */
  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ default: 'sent' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  tappedAt: Date;

  @CreateDateColumn()
  sentAt: Date;
}
