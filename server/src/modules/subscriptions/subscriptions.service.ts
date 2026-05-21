import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Subscription } from './subscription.entity.js';
import { User } from '../users/user.entity.js';
import { VerifyPurchaseDto } from './dto/verify-purchase.dto.js';
import { AppConfig } from '../admin/app-config.entity.js';
import { AppleStorekitService } from './apple-storekit.service.js';
import { GooglePlayBillingService } from './google-play-billing.service.js';

@Injectable()
export class SubscriptionsService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(AppConfig)
    private appConfigRepo: Repository<AppConfig>,
    private appleStorekit: AppleStorekitService,
    private googlePlay: GooglePlayBillingService,
  ) {}

  /** synchronize is off in prod — add the StoreKit 2 / Play Billing v6
   *  columns idempotently on every boot. */
  async onModuleInit() {
    const stmts = [
      `ALTER TABLE ll_subscriptions ADD COLUMN IF NOT EXISTS original_transaction_id varchar`,
      `ALTER TABLE ll_subscriptions ADD COLUMN IF NOT EXISTS product_id varchar`,
      `ALTER TABLE ll_subscriptions ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT false`,
      `ALTER TABLE ll_subscriptions ADD COLUMN IF NOT EXISTS environment varchar NOT NULL DEFAULT 'production'`,
      `ALTER TABLE ll_subscriptions ADD COLUMN IF NOT EXISTS in_trial boolean NOT NULL DEFAULT false`,
      `ALTER TABLE ll_subscriptions ADD COLUMN IF NOT EXISTS revoked_at timestamp NULL`,
      // Two LingoLoop accounts trying to verify the same Apple/Google
      // subscription would otherwise silently overwrite each other.
      // Partial index lets verifyPurchase upsert during the brief
      // window when the column is still null on fresh rows.
      `CREATE UNIQUE INDEX IF NOT EXISTS ll_subs_original_txn_uq
         ON ll_subscriptions (original_transaction_id)
         WHERE original_transaction_id IS NOT NULL`,
    ];
    for (const s of stmts) await this.subscriptionRepo.query(s);
  }

  async getCurrentSubscription(userId: string) {
    const user = await this.usersRepo.findOneByOrFail({ id: userId });
    const subscription = await this.ensureSubscription(user);

    return this.serialize(subscription, user);
  }

  private async ensureSubscription(user: User) {
    let subscription = await this.subscriptionRepo.findOne({
      where: { userId: user.id },
    });

    if (!subscription) {
      subscription = this.subscriptionRepo.create({
        userId: user.id,
        plan: user.subscriptionTier,
        store: 'mock',
        isActive: user.subscriptionTier === 'premium',
      });
      subscription = await this.subscriptionRepo.save(subscription);
    }

    return subscription;
  }

  /**
   * Verifies a fresh purchase / restore. Delegates to Apple JWS or
   * Google Play API depending on `source`; on a successful verification
   * the user's subscription row is upserted and their `subscriptionTier`
   * is flipped to 'premium'. Throws on verification failure so the
   * client never trusts a forged token.
   */
  async verifyPurchase(userId: string, dto: VerifyPurchaseDto) {
    const user = await this.usersRepo.findOneByOrFail({ id: userId });
    const subscription = await this.ensureSubscription(user);

    if (!dto.serverVerificationData) {
      // No proof — return current state untouched.
      return this.serialize(subscription, user);
    }

    if (dto.source === 'app_store') {
      const txn = await this.appleStorekit.verifyTransaction(
        dto.serverVerificationData,
      );
      if (txn.productId !== dto.productId) {
        throw new Error(`productId mismatch: ${txn.productId}`);
      }
      subscription.store = 'app_store';
      subscription.productId = txn.productId;
      subscription.storeTransactionId = txn.transactionId;
      subscription.originalTransactionId = txn.originalTransactionId;
      subscription.expiresAt = new Date(txn.expiresDate);
      subscription.environment =
        txn.environment.toLowerCase().includes('sandbox')
          ? 'sandbox'
          : 'production';
      subscription.inTrial = txn.offerType === 1;
      subscription.autoRenew = !txn.revocationDate;
      subscription.revokedAt = txn.revocationDate
        ? new Date(txn.revocationDate)
        : null;
      subscription.isActive =
        !txn.revocationDate && txn.expiresDate > Date.now();
    } else if (dto.source === 'play_store') {
      const state = await this.googlePlay.verifyPurchaseToken(
        dto.productId,
        dto.serverVerificationData,
      );
      if (!state) {
        // Service account not configured — fall back to the previous
        // state instead of granting unverified access.
        return this.serialize(subscription, user);
      }
      subscription.store = 'play_store';
      subscription.productId = state.productId;
      subscription.storeTransactionId = dto.purchaseId || state.purchaseToken;
      subscription.originalTransactionId = state.purchaseToken;
      subscription.expiresAt = new Date(state.expiryTime);
      subscription.environment = state.environment;
      subscription.inTrial = state.inTrial;
      subscription.autoRenew = state.autoRenew;
      subscription.revokedAt = state.revokedAt ? new Date(state.revokedAt) : null;
      subscription.isActive =
        !state.revokedAt && state.expiryTime > Date.now();
    } else {
      throw new Error(`Unknown source: ${dto.source}`);
    }

    subscription.plan = subscription.isActive ? 'premium' : 'free';
    user.subscriptionTier = subscription.plan;

    await this.usersRepo.save(user);
    const saved = await this.subscriptionRepo.save(subscription);
    return this.serialize(saved, user);
  }

  /**
   * App Store Server Notifications V2 handler. Apple POSTs a signed
   * JWS whenever any subscription state changes. We re-verify the
   * payload, look up the row by originalTransactionId, and apply the
   * change.
   *
   * Idempotent: replaying the same notificationUUID is safe because
   * we re-derive `isActive` / `revokedAt` / `expiresAt` from the
   * authoritative transaction info, not by mutating state.
   */
  async applyAppleNotification(signedPayload: string): Promise<void> {
    const note = await this.appleStorekit.verifyNotification(signedPayload);
    const txn = note.transaction;
    if (!txn) return;

    const sub = await this.subscriptionRepo.findOne({
      where: { originalTransactionId: txn.originalTransactionId },
    });
    if (!sub) return; // unknown user — possibly a sandbox stray, ignore.

    // Don't resurrect a soft-deleted user's premium tier. The
    // subscription row stays for audit but we won't push any state
    // changes onto a deleted account.
    const owner = await this.usersRepo.findOne({ where: { id: sub.userId } });
    if (!owner || owner.deletedAt || !owner.isActive) {
      this.logger.warn(
        `Apple webhook for deleted user ${sub.userId}, skipping`,
      );
      return;
    }

    sub.store = 'app_store';
    sub.productId = txn.productId;
    sub.storeTransactionId = txn.transactionId;
    sub.environment = txn.environment.toLowerCase().includes('sandbox')
      ? 'sandbox'
      : 'production';
    sub.expiresAt = new Date(txn.expiresDate);
    sub.inTrial = txn.offerType === 1;
    sub.revokedAt = txn.revocationDate ? new Date(txn.revocationDate) : null;
    sub.autoRenew = !txn.revocationDate &&
      note.subtype !== 'AUTO_RENEW_DISABLED';
    sub.isActive = !sub.revokedAt && sub.expiresAt.getTime() > Date.now();
    sub.plan = sub.isActive ? 'premium' : 'free';

    await this.subscriptionRepo.save(sub);
    await this.usersRepo.update(sub.userId, {
      subscriptionTier: sub.plan,
    });
  }

  /**
   * Google Play Real-time Developer Notification handler. Pub/Sub
   * pushes a JSON envelope; we decode the inner notification and
   * re-fetch authoritative state from the Play Developer API instead
   * of trusting fields in the message itself.
   */
  async applyGoogleNotification(data: any): Promise<void> {
    const buf = typeof data?.message?.data === 'string'
      ? Buffer.from(data.message.data, 'base64').toString('utf8')
      : null;
    if (!buf) return;
    const event = JSON.parse(buf);
    const sn = event.subscriptionNotification;
    if (!sn?.purchaseToken || !sn?.subscriptionId) return;

    const state = await this.googlePlay.verifyPurchaseToken(
      sn.subscriptionId,
      sn.purchaseToken,
    );
    if (!state) return;

    const sub = await this.subscriptionRepo.findOne({
      where: { originalTransactionId: sn.purchaseToken },
    });
    if (!sub) return;

    const owner = await this.usersRepo.findOne({ where: { id: sub.userId } });
    if (!owner || owner.deletedAt || !owner.isActive) {
      this.logger.warn(
        `Google webhook for deleted user ${sub.userId}, skipping`,
      );
      return;
    }

    sub.productId = state.productId;
    sub.storeTransactionId = state.purchaseToken;
    sub.expiresAt = new Date(state.expiryTime);
    sub.environment = state.environment;
    sub.inTrial = state.inTrial;
    sub.autoRenew = state.autoRenew;
    sub.revokedAt = state.revokedAt ? new Date(state.revokedAt) : null;
    sub.isActive = !state.revokedAt && state.expiryTime > Date.now();
    sub.plan = sub.isActive ? 'premium' : 'free';

    await this.subscriptionRepo.save(sub);
    await this.usersRepo.update(sub.userId, {
      subscriptionTier: sub.plan,
    });
  }

  /**
   * Safety net for missed EXPIRED webhooks. Every hour we scan for
   * subscriptions whose expiresAt has slipped past now while still
   * marked active, and downgrade them. If Apple/Google eventually do
   * send the EXPIRED event, the handler is idempotent so re-running
   * is a no-op.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepExpiredSubscriptions(): Promise<void> {
    const stale = await this.subscriptionRepo.find({
      where: {
        isActive: true,
        expiresAt: LessThan(new Date()),
      },
    });
    if (stale.length === 0) return;
    this.logger.log(`Sweeping ${stale.length} expired subscriptions`);
    for (const sub of stale) {
      sub.isActive = false;
      sub.plan = 'free';
      await this.subscriptionRepo.save(sub);
      await this.usersRepo.update(sub.userId, { subscriptionTier: 'free' });
    }
  }

  private serialize(subscription: Subscription, user: User) {
    return {
      plan: subscription.plan,
      isActive: subscription.isActive,
      expiresAt: subscription.expiresAt,
      store: subscription.store,
      productId: subscription.productId,
      autoRenew: subscription.autoRenew,
      inTrial: subscription.inTrial,
      environment: subscription.environment,
      subscriptionTier: user.subscriptionTier,
      displayPriceKrw: 3900,
      billingMode: subscription.store === 'mock' ? 'mock' : 'real',
    };
  }
}
