import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, QueryFailedError, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Subscription } from './subscription.entity.js';
import { User } from '../users/user.entity.js';
import { VerifyPurchaseDto } from './dto/verify-purchase.dto.js';
import { AppConfig } from '../admin/app-config.entity.js';
import { AppleStorekitService } from './apple-storekit.service.js';
import { GooglePlayBillingService } from './google-play-billing.service.js';

/** Same string set User.subscriptionTier uses; one place to update. */
type SubscriptionTier = 'free' | 'premium';

/**
 * Product IDs we recognize as our premium subscription. The JWS /
 * Play Developer API response is authoritative for which product the
 * user bought — we compare against THIS list (server-side knowledge),
 * not the client's `dto.productId` (which can drift).
 *
 * When you add tiers, add their store SKUs here and decide what each
 * one grants.
 */
const KNOWN_PRODUCT_IDS: readonly string[] = ['lingoloop_premium_monthly'];

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
    // ALTER TABLE — fatal if these fail, since the entity columns
    // wouldn't exist. We do want the boot to die loudly.
    const alters = [
      `ALTER TABLE ll_subscriptions ADD COLUMN IF NOT EXISTS original_transaction_id varchar`,
      `ALTER TABLE ll_subscriptions ADD COLUMN IF NOT EXISTS product_id varchar`,
      `ALTER TABLE ll_subscriptions ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT false`,
      `ALTER TABLE ll_subscriptions ADD COLUMN IF NOT EXISTS environment varchar NOT NULL DEFAULT 'production'`,
      `ALTER TABLE ll_subscriptions ADD COLUMN IF NOT EXISTS in_trial boolean NOT NULL DEFAULT false`,
      `ALTER TABLE ll_subscriptions ADD COLUMN IF NOT EXISTS revoked_at timestamp NULL`,
    ];
    for (const s of alters) await this.subscriptionRepo.query(s);

    // CREATE UNIQUE INDEX — non-fatal. `IF NOT EXISTS` skips the
    // "already there" case, but it does NOT suppress the "duplicate
    // rows in the table" error. If two users somehow ended up with
    // the same originalTransactionId before we shipped this, the
    // index creation throws and our server boot dies. Log + continue
    // so ops can dedupe at leisure without taking the whole API down.
    try {
      await this.subscriptionRepo.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ll_subs_original_txn_uq
           ON ll_subscriptions (original_transaction_id)
           WHERE original_transaction_id IS NOT NULL`,
      );
    } catch (e: any) {
      this.logger.error(
        `Could not create unique index on original_transaction_id: ${e.message}. Deduplicate ll_subscriptions and retry.`,
      );
    }
  }

  async getCurrentSubscription(userId: string) {
    const user = await this.usersRepo.findOneByOrFail({ id: userId });
    const subscription = await this.ensureSubscription(user);

    // Lazy downgrade: the hourly sweep is the primary mechanism, but
    // when a user opens the app right after expiry we want them on
    // the correct plan immediately instead of showing a stale
    // "premium" banner with a past expiry date.
    if (
      subscription.isActive &&
      subscription.expiresAt &&
      subscription.expiresAt.getTime() < Date.now()
    ) {
      subscription.isActive = false;
      subscription.plan = 'free';
      await this.subscriptionRepo.save(subscription);
      if (user.subscriptionTier !== 'free') {
        // Atomic, column-scoped UPDATE — never `usersRepo.save(user)`
        // here. A full-entity save would race with concurrent account
        // deletion: a soft-delete sets `deletedAt` + mangles the
        // email/providerId, and our stale in-memory user (loaded
        // before deletion) would un-mangle on save, restoring the
        // user's identity.
        await this.updateUserTierIfActive(user.id, 'free');
        user.subscriptionTier = 'free';
      }
    }

    return this.serialize(subscription, user);
  }

  private async ensureSubscription(user: User) {
    const existing = await this.subscriptionRepo.findOne({
      where: { userId: user.id },
    });
    if (existing) return existing;

    const fresh = this.subscriptionRepo.create({
      userId: user.id,
      plan: user.subscriptionTier,
      store: 'mock',
      isActive: user.subscriptionTier === 'premium',
    });
    try {
      return await this.subscriptionRepo.save(fresh);
    } catch (e: any) {
      // Concurrent /me + /verify on a brand-new user can race here:
      // both findOne return null, both try to insert. The OneToOne
      // join column on user_id makes the second insert hit 23505.
      // Re-fetch instead of leaking 500 to the caller.
      const pgCode = (e as any).code ?? (e as any).driverError?.code;
      if (e instanceof QueryFailedError && pgCode === '23505') {
        const winner = await this.subscriptionRepo.findOne({
          where: { userId: user.id },
        });
        if (winner) return winner;
      }
      throw e;
    }
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
      // Trust the JWS productId, not the client's claim. A
      // client-side bug or stale build could send the wrong
      // productId; Apple's signed payload is the authority. We just
      // make sure it's a product WE recognize so a user can't get
      // premium by buying an unrelated SKU under the same app.
      if (!KNOWN_PRODUCT_IDS.includes(txn.productId)) {
        throw new BadRequestException(
          `Unknown Apple productId: ${txn.productId}`,
        );
      }
      subscription.store = 'app_store';
      subscription.productId = txn.productId;
      subscription.storeTransactionId = txn.transactionId;
      subscription.originalTransactionId = txn.originalTransactionId;
      // The JWS doesn't carry gracePeriodExpiresDate (that's in
      // signedRenewalInfo, only on the webhook). On a client-driven
      // verify we don't have grace info — but a webhook for the
      // same row might have already set a later expiresAt (grace-
      // extended). Take the MAX so a restore call during grace
      // never backdates the row over the webhook's good data.
      const existingExpiry = subscription.expiresAt?.getTime() ?? 0;
      const effectiveExpiry = Math.max(existingExpiry, txn.expiresDate);
      subscription.expiresAt = new Date(effectiveExpiry);
      subscription.environment =
        txn.environment.toLowerCase().includes('sandbox')
          ? 'sandbox'
          : 'production';
      // offerType=1 covers BOTH introductory free trials and paid
      // intro offers (e.g. $0.99 first month). Only the FREE_TRIAL
      // discount type is actually a trial; if offerDiscountType is
      // absent, fall back to treating offerType=1 as a trial since
      // Apple historically omitted the field.
      subscription.inTrial =
        txn.offerType === 1 &&
        (!txn.offerDiscountType || txn.offerDiscountType === 'FREE_TRIAL');
      subscription.autoRenew = !txn.revocationDate;
      subscription.revokedAt = txn.revocationDate
        ? new Date(txn.revocationDate)
        : null;
      subscription.isActive =
        !txn.revocationDate && effectiveExpiry > Date.now();
    } else if (dto.source === 'play_store') {
      const state = await this.googlePlay.verifyPurchaseToken(
        dto.serverVerificationData,
      );
      if (!state) {
        // Service account not configured — fall back to the previous
        // state instead of granting unverified access.
        return this.serialize(subscription, user);
      }
      // Same JWS-trust pattern as the Apple branch — Google's API
      // response is authoritative for productId.
      if (!KNOWN_PRODUCT_IDS.includes(state.productId)) {
        throw new BadRequestException(
          `Unknown Google productId: ${state.productId}`,
        );
      }
      subscription.store = 'play_store';
      subscription.productId = state.productId;
      subscription.storeTransactionId = state.purchaseToken;
      subscription.originalTransactionId = state.purchaseToken;
      subscription.expiresAt = new Date(state.expiryTime);
      subscription.environment = state.environment;
      subscription.inTrial = state.inTrial;
      subscription.autoRenew = state.autoRenew;
      subscription.revokedAt = state.revokedAt ? new Date(state.revokedAt) : null;
      subscription.isActive =
        !state.revokedAt && state.expiryTime > Date.now();
    } else {
      throw new BadRequestException(`Unknown source: ${dto.source}`);
    }

    subscription.plan = subscription.isActive ? 'premium' : 'free';
    user.subscriptionTier = subscription.plan;

    // Same atomic-update reasoning as in getCurrentSubscription —
    // never full-entity `save(user)` here; even though this path is
    // JWT-authed (so the user can't be deleted by ANOTHER request),
    // the in-memory copy is still old by the time we get here.
    await this.updateUserTierIfActive(
      user.id,
      subscription.isActive ? 'premium' : 'free',
    );
    try {
      const saved = await this.subscriptionRepo.save(subscription);
      return this.serialize(saved, user);
    } catch (e: any) {
      // Postgres unique violation code. Triggered when another
      // LingoLoop user already verified this Apple/Google
      // subscription. TypeORM's QueryFailedError spread-copies the
      // pg driver's properties onto the exception, so `e.code` is
      // usually populated — but check `.driverError.code` too as
      // defense in case a future TypeORM release changes that.
      const pgCode =
        (e as any).code ?? (e as any).driverError?.code;
      if (e instanceof QueryFailedError && pgCode === '23505') {
        throw new ConflictException(
          '이 구독은 다른 LingoLoop 계정에 이미 연결되어 있어요. 해당 계정으로 로그인해 주세요.',
        );
      }
      throw e;
    }
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
    this.logger.log(
      `Apple notification ${note.notificationType}` +
        (note.subtype ? `/${note.subtype}` : '') +
        ` uuid=${note.notificationUUID}`,
    );
    if (!txn) {
      // TEST notifications + a handful of metadata-only types
      // legitimately omit signedTransactionInfo. Not warn-worthy.
      this.logger.log(
        `Apple notification ${note.notificationUUID} has no transaction (likely TEST)`,
      );
      return;
    }

    const sub = await this.subscriptionRepo.findOne({
      where: { originalTransactionId: txn.originalTransactionId },
    });
    if (!sub) {
      // First-purchase race: the client's verifyPurchase hasn't
      // landed yet so we have no row to update. StoreKit will retry
      // the webhook and the client will populate the row on next
      // launch — log so we can tell apart "ignored intentionally"
      // from "lost" in ops.
      this.logger.warn(
        `Apple notification for unknown originalTransactionId=…${tail(txn.originalTransactionId)} (uuid=${note.notificationUUID})`,
      );
      return;
    }

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

    // Past-cycle guard.
    // REFUND / REVOKE notifications carry the JWS for the REFUNDED
    // transaction — which may be an old cycle. If we naively wrote
    // its expiresDate onto the row, a refund of cycle N would
    // backdate the row to cycle N's expiry and revoke a user who's
    // currently paid up on cycle N+M. Skip everything except the
    // revocation marker; let the next renewal / expiry webhook
    // refresh the rest.
    if (
      sub.storeTransactionId &&
      sub.storeTransactionId !== txn.transactionId &&
      sub.expiresAt &&
      txn.expiresDate < sub.expiresAt.getTime()
    ) {
      this.logger.log(
        `Apple ${note.notificationType} for past cycle txn=…${tail(txn.transactionId)} (current=…${tail(sub.storeTransactionId)}), state untouched`,
      );
      return;
    }

    // Grace-period handling. On DID_FAIL_TO_RENEW (or other failures
    // mid-cycle), Apple's transaction carries the just-ended cycle's
    // expiresDate (in the past) and `signedRenewalInfo` includes a
    // `gracePeriodExpiresDate` covering the billing-retry window (up
    // to ~16 days). Per Apple's "Identifying Subscription Status"
    // guidance, the user remains entitled until that timestamp. Take
    // whichever is later as the effective expiry — also folds in
    // RENEWAL_EXTENDED notifications naturally.
    const graceUntil = note.renewal?.gracePeriodExpiresDate;
    const effectiveExpiry =
      typeof graceUntil === 'number' && graceUntil > txn.expiresDate
        ? graceUntil
        : txn.expiresDate;
    const expiresAt = new Date(effectiveExpiry);
    const revokedAt = txn.revocationDate ? new Date(txn.revocationDate) : null;
    const isActive = !revokedAt && effectiveExpiry > Date.now();
    // The notification subtype only carries AUTO_RENEW_DISABLED on
    // DID_CHANGE_RENEWAL_STATUS — other types (DID_RENEW, REFUND,
    // EXPIRED, ...) would silently flip autoRenew back to true if we
    // relied on it. Use the verified renewal info when available;
    // otherwise infer from revocation.
    const autoRenew = note.renewal
      ? note.renewal.autoRenewStatus === 1 && !txn.revocationDate
      : !txn.revocationDate;

    // Targeted UPDATE instead of save() so two webhooks arriving
    // simultaneously don't clobber each other's non-overlapping
    // column writes. save() issues SET col1=?,col2=?,… for the FULL
    // entity, including in-memory-stale columns.
    await this.subscriptionRepo.update(
      { id: sub.id },
      {
        store: 'app_store',
        productId: txn.productId,
        storeTransactionId: txn.transactionId,
        environment: txn.environment.toLowerCase().includes('sandbox')
          ? 'sandbox'
          : 'production',
        expiresAt,
        inTrial:
          txn.offerType === 1 &&
          (!txn.offerDiscountType || txn.offerDiscountType === 'FREE_TRIAL'),
        revokedAt,
        autoRenew,
        isActive,
        plan: isActive ? 'premium' : 'free',
      },
    );
    await this.updateUserTierIfActive(
      sub.userId,
      isActive ? 'premium' : 'free',
    );
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
    if (!buf) {
      this.logger.warn('Google webhook: no message.data');
      return;
    }
    const event = JSON.parse(buf);
    const sn = event.subscriptionNotification;
    const messageId = data?.message?.messageId ?? '?';

    // Voided purchases (refunds, chargebacks) come on the SAME Pub/Sub
    // channel but in a different envelope — there's no
    // subscriptionNotification, so the old code path used to log + skip
    // and let the refunded user keep premium until natural cycle end.
    // Both voidedReason values (PAYMENT_DECLINED, OTHER) should
    // revoke immediately.
    const vp = event.voidedPurchaseNotification;
    if (vp?.purchaseToken) {
      this.logger.log(
        `Google void purchaseToken=…${tail(vp.purchaseToken)} reason=${vp.voidedReason} messageId=${messageId}`,
      );
      await this.revokeByPurchaseToken(vp.purchaseToken, messageId);
      return;
    }

    if (!sn?.purchaseToken || !sn?.subscriptionId) {
      // Test pings / one-time-product events flow through this
      // endpoint too — log + skip.
      this.logger.log(
        `Google notification messageId=${messageId} kind=${
          event.testNotification ? 'test' : 'other'
        }`,
      );
      return;
    }
    this.logger.log(
      `Google notification type=${sn.notificationType} messageId=${messageId} sub=${sn.subscriptionId}`,
    );

    const state = await this.googlePlay.verifyPurchaseToken(
      sn.purchaseToken,
    );
    if (!state) {
      this.logger.warn(
        `Google webhook: verifyPurchaseToken returned null (service account not configured?) messageId=${messageId}`,
      );
      return;
    }

    const sub = await this.subscriptionRepo.findOne({
      where: { originalTransactionId: sn.purchaseToken },
    });
    if (!sub) {
      this.logger.warn(
        `Google notification for unknown purchaseToken messageId=${messageId}`,
      );
      return;
    }

    const owner = await this.usersRepo.findOne({ where: { id: sub.userId } });
    if (!owner || owner.deletedAt || !owner.isActive) {
      this.logger.warn(
        `Google webhook for deleted user ${sub.userId}, skipping`,
      );
      return;
    }

    const isActive = !state.revokedAt && state.expiryTime > Date.now();
    // Targeted UPDATE — see the Apple handler for the rationale.
    await this.subscriptionRepo.update(
      { id: sub.id },
      {
        productId: state.productId,
        storeTransactionId: state.purchaseToken,
        expiresAt: new Date(state.expiryTime),
        environment: state.environment,
        inTrial: state.inTrial,
        autoRenew: state.autoRenew,
        revokedAt: state.revokedAt ? new Date(state.revokedAt) : null,
        isActive,
        plan: isActive ? 'premium' : 'free',
      },
    );
    await this.updateUserTierIfActive(
      sub.userId,
      isActive ? 'premium' : 'free',
    );
  }

  /**
   * Revokes whichever subscription row holds `purchaseToken` as its
   * originalTransactionId. Used for Google's voidedPurchaseNotification
   * since those don't carry a subscriptionState we can pull from the
   * Play API (the purchase is gone).
   */
  private async revokeByPurchaseToken(
    purchaseToken: string,
    messageId: string,
  ): Promise<void> {
    const sub = await this.subscriptionRepo.findOne({
      where: { originalTransactionId: purchaseToken },
    });
    if (!sub) {
      this.logger.warn(
        `Google void for unknown purchaseToken messageId=${messageId}`,
      );
      return;
    }
    const owner = await this.usersRepo.findOne({ where: { id: sub.userId } });
    if (!owner || owner.deletedAt || !owner.isActive) {
      this.logger.warn(
        `Google void for deleted user ${sub.userId}, skipping`,
      );
      return;
    }
    await this.subscriptionRepo.update(
      { id: sub.id },
      {
        revokedAt: new Date(),
        autoRenew: false,
        isActive: false,
        plan: 'free',
      },
    );
    await this.updateUserTierIfActive(sub.userId, 'free');
  }

  /**
   * Atomic user-tier update that won't overwrite a user who soft-
   * deleted between our earlier `findOne` check and now. The webhook
   * handlers already gate on `owner.deletedAt`, but there's a tiny
   * window where the user could delete while we're processing —
   * this WHERE clause closes it.
   */
  private async updateUserTierIfActive(
    userId: string,
    tier: SubscriptionTier,
  ): Promise<void> {
    const result = await this.usersRepo.update(
      { id: userId, deletedAt: IsNull(), isActive: true },
      { subscriptionTier: tier },
    );
    if (!result.affected) {
      this.logger.warn(
        `Skipped tier update for ${userId} — user was deactivated mid-flow`,
      );
    }
  }

  /**
   * Safety net for missed EXPIRED webhooks. Every hour we scan for
   * subscriptions whose expiresAt has slipped past now while still
   * marked active, and downgrade them. If Apple/Google eventually do
   * send the EXPIRED event, the handler is idempotent so re-running
   * is a no-op.
   *
   * Note for ops: idempotent so it's safe to run on multiple
   * instances, but at horizontal scale it'll execute N times per
   * hour. If you ever scale beyond a single container, switch to a
   * Postgres advisory lock or a single-tenant worker.
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
      // Targeted update to avoid clobbering any column a concurrent
      // webhook might be writing for the same row.
      await this.subscriptionRepo.update(
        { id: sub.id },
        { isActive: false, plan: 'free' },
      );
      await this.updateUserTierIfActive(sub.userId, 'free');
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // helpers
  // ──────────────────────────────────────────────────────────────────

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

/** Last 8 chars of an identifier for log breadcrumbs without leaking
 *  the full purchase token / originalTransactionId. */
function tail(id: string | null | undefined): string {
  if (!id) return '<empty>';
  return id.length <= 8 ? id : id.slice(-8);
}
