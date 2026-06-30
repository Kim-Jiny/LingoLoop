import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ll_app_config')
export class AppConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 'lingoloop_premium_monthly' })
  premiumMonthlyProductId: string;

  @Column({ default: false })
  billingEnabled: boolean;

  @Column({ nullable: true })
  iosProductGroupId: string;

  @Column({ nullable: true })
  androidBasePlanId: string;

  /**
   * 무료체험 노출 토글. 스토어(App Store introductory offer / Play
   * free-trial offer)에 실제 체험 offer를 설정한 뒤 이 값을 켜면 앱
   * paywall이 "N일 무료체험" 문구로 바뀐다. 스토어 offer 자체가
   * 체험을 부여하므로 이건 순수 표시/유도용 플래그.
   */
  @Column({ name: 'trialEnabled', default: false })
  trialEnabled: boolean;

  /** 무료체험 일수. 스토어 offer 기간과 일치시켜 둘 것 (표시용). */
  @Column({ name: 'trialDays', default: 7 })
  trialDays: number;

  @Column({ type: 'text', nullable: true })
  adminNote: string;

  /**
   * 운영자 푸시 알림 수신 토글. eventType → enabled.
   * 미설정 / 키 누락 시 기본 true (이전 호환).
   * 예: { renew: false, fail: true, inquiry: true, ... }
   * 모든 admin (User.isAdmin=true)에게 공통 적용 — 1~2명 admin 팀에선
   * 글로벌 토글이 충분. 향후 admin이 늘면 per-user로 마이그레이션.
   */
  @Column({ name: 'adminPushPrefs', type: 'jsonb', nullable: true })
  adminPushPrefs: Record<string, boolean> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
