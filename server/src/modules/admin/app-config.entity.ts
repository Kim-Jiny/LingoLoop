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

  @Column({ default: true })
  billingEnabled: boolean;

  @Column({ nullable: true })
  iosProductGroupId: string;

  @Column({ nullable: true })
  androidBasePlanId: string;

  @Column({ type: 'text', nullable: true })
  adminNote: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
