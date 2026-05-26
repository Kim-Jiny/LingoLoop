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

  @Column({ default: 'open' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
