import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Append-only audit log of every subscription state event. Written
 * from each webhook, verify, sweep, and lazy-downgrade path so that
 * "I paid but didn't get premium" support cases have something
 * concrete to look at after the fact — without this, only the
 * current state of `ll_subscriptions` is in the DB, and once console
 * logs roll off we can't tell whether Apple's notification arrived,
 * whether it was rejected (past-cycle / deleted-user / unknown
 * product), or just silently ignored.
 *
 * The row is intentionally narrow:
 *   - source tells us WHICH code path wrote it
 *   - eventType is the upstream label (Apple notificationType, Google
 *     notificationType, or a sentinel like 'lazy_downgrade')
 *   - outcome is one of 'applied' | 'skipped' | 'rejected' | 'error'
 *     so we can grep for "every event where outcome != applied"
 *   - notificationUuid lets us dedup against Apple's retries and
 *     correlate with the provider's dashboard
 *   - payload carries the decoded (verified!) transaction info as
 *     JSON; we don't store the raw JWS because it's large and we'd
 *     have to re-verify it to trust it anyway
 *
 * Indexed by (userId, occurredAt DESC) so support lookups are fast;
 * by notificationUuid for idempotency / dedup queries.
 */
@Entity('ll_subscription_events')
@Index('ll_sub_events_user_at_idx', ['userId', 'occurredAt'])
@Index('ll_sub_events_uuid_idx', ['notificationUuid'])
export class SubscriptionEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ name: 'subscription_id', nullable: true })
  subscriptionId: number | null;

  /**
   * Which code path wrote the row.
   * 'apple_webhook' | 'google_webhook' | 'google_voided' |
   * 'apple_verify' | 'play_verify' | 'sweep' | 'lazy_downgrade' |
   * 'user_deleted'
   */
  @Column()
  source: string;

  /**
   * Apple notificationType + subtype joined with '/', e.g.
   * 'DID_RENEW/BILLING_RECOVERY'. For Google: Pub/Sub
   * notificationType numeric string. For other sources: a sentinel
   * like 'sweep_expired'.
   */
  @Column({ name: 'event_type', nullable: true })
  eventType: string | null;

  @Column({ name: 'notification_uuid', nullable: true })
  notificationUuid: string | null;

  /** Original transaction id (Apple) or purchaseToken (Google). */
  @Column({ name: 'original_transaction_id', nullable: true })
  originalTransactionId: string | null;

  @Column({ name: 'product_id', nullable: true })
  productId: string | null;

  /** 'applied' | 'skipped' | 'rejected' | 'error' */
  @Column()
  outcome: string;

  @Column({ name: 'outcome_reason', nullable: true, type: 'text' })
  outcomeReason: string | null;

  /** Decoded transaction info / state for forensics. JSONB. */
  @Column({ type: 'jsonb', nullable: true })
  payload: any;

  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt: Date;
}
