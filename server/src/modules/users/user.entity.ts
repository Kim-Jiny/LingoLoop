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
