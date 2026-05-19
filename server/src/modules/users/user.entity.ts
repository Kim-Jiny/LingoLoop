import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { LearningProgress } from '../progress/learning-progress.entity.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { RefreshToken } from '../auth/refresh-token.entity.js';

export enum AuthProvider {
  EMAIL = 'email',
  GOOGLE = 'google',
  APPLE = 'apple',
  KAKAO = 'kakao',
}

@Entity('ll_users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  password: string;

  @Column({ nullable: true })
  nickname: string;

  @Column({ type: 'enum', enum: AuthProvider, default: AuthProvider.EMAIL })
  provider: AuthProvider;

  @Column({ nullable: true })
  providerId: string;

  @Column({ default: 'en' })
  targetLanguage: string;

  @Column({ default: 'ko' })
  nativeLanguage: string;

  // IANA timezone from the device (captured at login). Drives the daily
  // sentence reset boundary so "today" flips at the user's local midnight.
  @Column({ default: 'Asia/Seoul' })
  timezone: string;

  // Sentences the user aims to complete per day.
  @Column({ type: 'int', default: 3 })
  dailyGoal: number;

  // Chosen learning track. null → app shows the track survey first.
  @Column({ type: 'varchar', nullable: true })
  learningTrack: string | null;

  @Column({ default: 'free' })
  subscriptionTier: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => LearningProgress, (progress) => progress.user)
  progress: LearningProgress[];

  @OneToMany(() => DailyAssignment, (assignment) => assignment.user)
  dailyAssignments: DailyAssignment[];

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];
}
