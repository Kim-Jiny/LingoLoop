import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './subscription.entity.js';
import { User } from '../users/user.entity.js';
import { VerifyPurchaseDto } from './dto/verify-purchase.dto.js';
import { AppConfig } from '../admin/app-config.entity.js';
import { AppleStorekitService } from './apple-storekit.service.js';
import { GooglePlayBillingService } from './google-play-billing.service.js';

@Injectable()
export class SubscriptionsService implements OnModuleInit {
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
