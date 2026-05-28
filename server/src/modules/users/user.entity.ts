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

  /**
   * 운영자 권한 플래그. true면 (1) /backstage user detail에서 토글로
   * 부여됨 (2) 신규 문의 / 결제 / 환불 / 구독취소 같은 주요 이벤트
   * 푸시를 본인 디바이스 토큰으로 추가 수신. 일반 LingoLoop 앱으로
   * 로그인한 device token을 그대로 활용 — 별도 admin 앱 없음.
   */
  @Column({ name: 'isAdmin', default: false })
  isAdmin: boolean;

  /**
   * Set when the user soft-deletes their account. Once non-null, the
   * row stays in the DB for audit but the email + every social
   * identity's providerId are prefixed with `del_<rand5>_` so the
   * unique constraints free up the original values for re-signup.
   */
  @Column({ name: 'deletedAt', type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  /**
   * 마지막으로 클라이언트가 인증 흐름(로그인/리프레시/소셜)에서 접속한
   * 시점과 그때의 OS/앱 버전/디바이스 정보. backstage 유저 상세에서
   * "최근 접속" / OS·앱 버전 / 디바이스 모델을 표시해 운영자가
   * 한눈에 사용자의 환경을 파악하기 위함.
   *
   * 매 API 호출이 아닌 인증 시점에만 갱신 → 쓰기 부하 최소화.
   * 토큰은 15분~7일 주기로 갱신되므로 "최근 활동"의 근사치로 충분.
   */
  @Column({ name: 'lastSeenAt', type: 'timestamp', nullable: true })
  lastSeenAt: Date | null;

  @Column({ name: 'lastPlatform', type: 'varchar', nullable: true })
  lastPlatform: string | null;

  @Column({ name: 'lastOsVersion', type: 'varchar', nullable: true })
  lastOsVersion: string | null;

  @Column({ name: 'lastAppVersion', type: 'varchar', nullable: true })
  lastAppVersion: string | null;

  @Column({ name: 'lastAppBuild', type: 'varchar', nullable: true })
  lastAppBuild: string | null;

  @Column({ name: 'lastDeviceModel', type: 'varchar', nullable: true })
  lastDeviceModel: string | null;

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
