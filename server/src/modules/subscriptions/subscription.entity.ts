import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity.js';

@Entity('ll_subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ default: 'free' })
  plan: string;

  /** 'app_store' | 'play_store' | 'mock' | 'none'. */
  @Column({ default: 'none' })
  store: string;

  /**
   * Current cycle's transaction ID. Replaced on every renewal.
   * iOS: `transactionId` from JWSTransaction. Android: `orderId`.
   */
  @Column({ nullable: true })
  storeTransactionId: string;

  /**
   * Stable ID that survives renewals — pin user to the same Apple/Google
   * subscription across the whole lifecycle. iOS: `originalTransactionId`.
   * Android: `purchaseToken` (we keep the latest valid token here).
   */
  @Column({ name: 'original_transaction_id', nullable: true })
  originalTransactionId: string | null;

  /** Product/SKU the user is subscribed to. */
  @Column({ name: 'product_id', nullable: true })
  productId: string | null;

  /** Auto-renew flag returned by the store. */
  @Column({ name: 'auto_renew', default: false })
  autoRenew: boolean;

  /** 'sandbox' | 'production'. */
  @Column({ default: 'production' })
  environment: string;

  /** True while the user is inside the introductory free trial. */
  @Column({ name: 'in_trial', default: false })
  inTrial: boolean;

  /** Set when Apple/Google reports the user revoked / refunded. */
  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
