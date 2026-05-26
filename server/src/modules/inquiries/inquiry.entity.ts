import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity.js';

@Entity('ll_inquiries')
export class Inquiry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ default: 'general' })
  category: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  /**
   * 'open' (사용자가 보낸 직후) | 'answered' (관리자가 답변 작성) |
   * 'closed' (정리됨, 노이즈 차단용 — 현재 미사용). status 기반으로
   * /backstage/inquiries 필터링과 unread 배지가 갈림.
   */
  @Column({ default: 'open' })
  status: string;

  /** 관리자 답변 본문. 답변 전엔 null. */
  @Column({ type: 'text', nullable: true })
  reply: string | null;

  /** 답변 작성 시각 — 사용자측 마지막 알림 트리거 시점. */
  @Column({ name: 'replied_at', type: 'timestamptz', nullable: true })
  repliedAt: Date | null;

  /** 어느 관리자가 답변했는지 — admin 사용자명. 감사용. */
  @Column({ name: 'replied_by', type: 'varchar', nullable: true })
  repliedBy: string | null;

  /**
   * 사용자가 앱에서 답변을 마지막으로 확인한 시각. unread 배지
   * 계산용. null이고 repliedAt이 있으면 새 답변(읽지 않음).
   */
  @Column({ name: 'user_read_at', type: 'timestamptz', nullable: true })
  userReadAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
