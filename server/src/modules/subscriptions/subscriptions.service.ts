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
import { SubscriptionEvent } from './subscription-event.entity.js';
import { User } from '../users/user.entity.js';
import { VerifyPurchaseDto } from './dto/verify-purchase.dto.js';
import { AppConfig } from '../admin/app-config.entity.js';
import { AppleStorekitService } from './apple-storekit.service.js';
import {
  AppleAppStoreApiService,
  ConsumptionRequestBody,
} from './apple-appstore-api.service.js';
import { GooglePlayBillingService } from './google-play-billing.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

/** Same string set User.subscriptionTier uses; one place to update. */
type SubscriptionTier = 'free' | 'premium';

/** Intermediate counts for Apple's CONSUMPTION_REQUEST response. */
interface ConsumptionMetrics {
  accountAgeDays: number;
  playTimeMinutes: number;
  consumptionStatus: 1 | 2 | 3;
  lifetimePurchasesUsd: number;
  lifetimeRefundsUsd: number;
}

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
    @InjectRepository(SubscriptionEvent)
    private eventsRepo: Repository<SubscriptionEvent>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(AppConfig)
    private appConfigRepo: Repository<AppConfig>,
    private appleStorekit: AppleStorekitService,
    private appleAppStoreApi: AppleAppStoreApiService,
    private googlePlay: GooglePlayBillingService,
    private notificationsService: NotificationsService,
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

    // Event log table (append-only audit trail).
    try {
      await this.subscriptionRepo.query(
        `CREATE TABLE IF NOT EXISTS ll_subscription_events (
           id serial PRIMARY KEY,
           user_id varchar NULL,
           subscription_id integer NULL,
           source varchar NOT NULL,
           event_type varchar NULL,
           notification_uuid varchar NULL,
           original_transaction_id varchar NULL,
           product_id varchar NULL,
           outcome varchar NOT NULL,
           outcome_reason text NULL,
           payload jsonb NULL,
           occurred_at timestamp NOT NULL DEFAULT NOW()
         )`,
      );
      await this.subscriptionRepo.query(
        `CREATE INDEX IF NOT EXISTS ll_sub_events_user_at_idx
           ON ll_subscription_events (user_id, occurred_at DESC)`,
      );
      await this.subscriptionRepo.query(
        `CREATE INDEX IF NOT EXISTS ll_sub_events_uuid_idx
           ON ll_subscription_events (notification_uuid)`,
      );
    } catch (e: any) {
      this.logger.error(
        `Could not create ll_subscription_events: ${e.message}`,
      );
    }

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
    //
    // The UPDATE includes the same expiry predicate so a webhook
    // that renewed the subscription between our load and now (or
    // even between us computing "expired" and writing) won't lose
    // its bump. Same race avoidance as the sweep cron.
    if (
      subscription.isActive &&
      subscription.expiresAt &&
      subscription.expiresAt.getTime() < Date.now()
    ) {
      const result = await this.subscriptionRepo.update(
        {
          id: subscription.id,
          isActive: true,
          expiresAt: LessThan(new Date()),
        },
        { isActive: false, plan: 'free' },
      );
      if (result.affected) {
        subscription.isActive = false;
        subscription.plan = 'free';
        if (user.subscriptionTier !== 'free') {
          await this.updateUserTierIfActive(user.id, 'free');
          user.subscriptionTier = 'free';
        }
        await this.recordEvent({
          userId: user.id,
          subscriptionId: subscription.id,
          source: 'lazy_downgrade',
          eventType: 'lazy_downgrade',
          originalTransactionId: subscription.originalTransactionId,
          productId: subscription.productId,
          outcome: 'applied',
        });
      }
    }

    // Self-heal tier ↔ subscription 미스매치.
    // verifyPurchase의 "save FIRST → tier update SECOND" 흐름이나
    // cron sweep 중 crash, 또는 admin 수동 DB 손질로 subscription.
    // isActive=false인데 user.tier='premium'으로 남는 catastrophic
    // 동기화 깨짐이 발생 가능. subscription row를 source of truth로
    // 삼아 tier를 맞춤 — 사용자가 앱 열 때 자동 정합성 복구.
    if (!subscription.isActive && user.subscriptionTier === 'premium') {
      await this.updateUserTierIfActive(user.id, 'free');
      user.subscriptionTier = 'free';
      await this.recordEvent({
        userId: user.id,
        subscriptionId: subscription.id,
        source: 'self_heal',
        eventType: 'tier_mismatch_fixed',
        originalTransactionId: subscription.originalTransactionId,
        productId: subscription.productId,
        outcome: 'applied',
        outcomeReason: 'subscription_inactive_but_tier_premium',
      });
      this.logger.warn(
        `Self-heal: user ${user.id} had tier='premium' but subscription.isActive=false. Synced to free.`,
      );
    }

    return this.serialize(subscription, user);
  }

  /**
   * 사용자 본인 화면 노출용 구독 이력. ll_subscription_events에서
   * outcome='applied'만 + 사용자에게 의미 있는 type만 골라 normalized
   * 표시 라벨로 변환. 운영자용 raw audit log와 분리 — 사용자는
   * 'sweep_expired', 'self_heal' 같은 내부 sentinel을 볼 필요 없음.
   *
   * 각 row의 'kind':
   *   purchase  — 첫 구매 / 복원
   *   renew     — 자동 갱신
   *   cancel    — 사용자가 자동갱신 끔 (다음 결제 안 됨)
   *   resume    — 사용자가 자동갱신 다시 켬
   *   refund    — 환불
   *   expire    — 기간 만료 → free 강등
   *   trial     — 무료 체험 시작 (있는 경우)
   */
  async getHistory(userId: string, limit = 30) {
    const rows = await this.eventsRepo.find({
      where: { userId },
      order: { occurredAt: 'DESC' },
      take: Math.min(100, Math.max(1, limit)),
    });

    type View = {
      occurredAt: Date;
      kind:
        | 'purchase'
        | 'renew'
        | 'cancel'
        | 'resume'
        | 'refund'
        | 'expire'
        | 'trial'
        | 'grant'
        | 'revoke';
      productId: string | null;
      // payload에서 추출 가능하면 — 신규 expiresAt 또는 환불 사유 등.
      expiresAt: Date | null;
      label: string; // 사용자에게 보일 짧은 한글 라벨
      note: string | null; // 추가 안내(예: 환불 사유, 갱신 가격 등)
    };

    const out: View[] = [];
    for (const r of rows) {
      if (r.outcome !== 'applied') continue;
      const t = (r.eventType ?? '').split('/')[0]; // subtype 떼기

      // payload는 jsonb. expiresDate(Apple) 또는 expiresAt 같은 필드를 시도.
      const payloadExpires =
        r.payload?.expiresDate ??
        r.payload?.expiresAt ??
        r.payload?.expiryTimeMillis ??
        null;
      const expiresAt = payloadExpires
        ? new Date(Number(payloadExpires) || payloadExpires)
        : null;

      let kind: View['kind'] | null = null;
      let label = '';
      let note: string | null = null;

      // 운영자 지급/회수 — Apple/Google 정규 이벤트보다 우선 매칭.
      if (r.source === 'admin_grant') {
        kind = 'grant';
        label = '운영자 지급';
        const days = r.payload?.days;
        const newExp = r.payload?.newExpiresAt;
        const exp = newExp ? new Date(newExp) : null;
        const expStr = exp
          ? `${exp.getFullYear()}.${String(exp.getMonth() + 1).padStart(2, '0')}.${String(exp.getDate()).padStart(2, '0')}`
          : null;
        if (days != null && expStr) {
          note = `${days}일 추가 · ${expStr}까지`;
        } else if (days != null) {
          note = `${days}일 추가`;
        } else if (expStr) {
          note = `${expStr}까지`;
        }
        if (r.outcomeReason) {
          note = note ? `${note} · ${r.outcomeReason}` : r.outcomeReason;
        }
      } else if (r.source === 'admin_revoke') {
        kind = 'revoke';
        label = '운영자 회수';
        note = r.outcomeReason ?? '프리미엄 권한이 즉시 종료됐어요.';
      }
      // Apple notification types
      else if (
        t === 'SUBSCRIBED' ||
        t === 'OFFER_REDEEMED' ||
        r.source === 'apple_verify' ||
        r.source === 'play_verify'
      ) {
        kind = 'purchase';
        label = '구독 시작';
      } else if (t === 'DID_RENEW') {
        kind = 'renew';
        label = '자동 갱신';
      } else if (t === 'DID_CHANGE_RENEWAL_STATUS') {
        // payload.autoRenewStatus가 0이면 cancel, 1이면 resume.
        const auto = r.payload?.autoRenewStatus;
        if (auto === 0 || auto === '0' || auto === false) {
          kind = 'cancel';
          label = '자동 갱신 해지';
          note = '현재 기간 종료 시 자동 갱신되지 않아요.';
        } else if (auto === 1 || auto === '1' || auto === true) {
          kind = 'resume';
          label = '자동 갱신 재개';
        }
      } else if (t === 'REFUND' || t === 'REVOKE') {
        kind = 'refund';
        label = '환불 처리';
      } else if (t === 'EXPIRED' || t === 'sweep_expired') {
        kind = 'expire';
        label = '구독 만료';
      } else if (t === 'OFFER_REDEEMED' || t === 'INTRODUCTORY_OFFER') {
        kind = 'trial';
        label = '무료 체험 시작';
      } else if (t === 'DID_FAIL_TO_RENEW') {
        // 결제 실패는 사용자에게 노출 의미 있음.
        kind = 'cancel';
        label = '갱신 결제 실패';
        note = '결제 수단을 확인해 주세요.';
      }
      // Google numeric types (간단 매핑 — 1:RECOVERED, 2:RENEWED, 3:CANCELED, 4:PURCHASED, 5:ON_HOLD, 12:REVOKED, 13:EXPIRED)
      else if (t === '4' || t === '1') {
        kind = 'purchase';
        label = t === '1' ? '구독 복구' : '구독 시작';
      } else if (t === '2') {
        kind = 'renew';
        label = '자동 갱신';
      } else if (t === '3') {
        kind = 'cancel';
        label = '자동 갱신 해지';
        note = '현재 기간 종료 시 자동 갱신되지 않아요.';
      } else if (t === '12') {
        kind = 'refund';
        label = '환불 처리';
      } else if (t === '13') {
        kind = 'expire';
        label = '구독 만료';
      }

      if (!kind) continue;
      out.push({
        occurredAt: r.occurredAt,
        kind,
        productId: r.productId,
        expiresAt,
        label,
        note,
      });
    }

    // Dedupe: 같은 kind + productId가 짧은 시간 안에 여러 번 기록되는
    // 케이스 (예: apple_verify + 같은 트랜잭션 webhook SUBSCRIBED가
    // 초 단위 차이로 둘 다 'purchase'로 매핑되거나, push 재시도로
    // 같은 갱신 알림이 두 번 들어오는 경우)를 사용자 시점에선 하나로.
    // 이력은 occurredAt DESC라 가장 최신 것만 유지.
    const dedupeWindowMs = 5 * 60 * 1000;
    const lastSeenMs = new Map<string, number>();
    const collapsed: View[] = [];
    for (const v of out) {
      const key = `${v.kind}:${v.productId ?? ''}`;
      const prev = lastSeenMs.get(key);
      const cur = v.occurredAt.getTime();
      if (prev != null && prev - cur < dedupeWindowMs) continue;
      lastSeenMs.set(key, cur);
      collapsed.push(v);
    }
    return { items: collapsed };
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
      const pgCode = e.code ?? e.driverError?.code;
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

    // Snapshot the pre-verify state so we can skip the audit insert on
    // no-op re-verifies. iOS StoreKit fires the same `purchased` /
    // `restored` event multiple times per launch, and our app calls
    // /verify on each; without this dedupe the audit log racks up
    // dozens of identical "applied verify" rows for one real purchase.
    const priorTxnId = subscription.storeTransactionId ?? null;
    const priorExpiresAt = subscription.expiresAt?.getTime() ?? null;
    const priorRevokedAt = subscription.revokedAt?.getTime() ?? null;

    if (!dto.serverVerificationData) {
      // No proof — return current state untouched. Log so support
      // can spot misconfigured clients hitting /verify without a JWS.
      await this.recordEvent({
        userId: user.id,
        subscriptionId: subscription.id,
        source: dto.source === 'app_store' ? 'apple_verify' : 'play_verify',
        eventType: 'verify',
        productId: dto.productId,
        outcome: 'skipped',
        outcomeReason: 'no_serverVerificationData',
      });
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
      // The JWS doesn't carry gracePeriodExpiresDate (that's in
      // signedRenewalInfo, only on the webhook). On a client-driven
      // verify we don't have grace info — but a webhook for the
      // same chain might have already set a later expiresAt (grace-
      // extended). Take the MAX so a restore call during grace
      // never backdates the row over the webhook's good data.
      //
      // Important: only carry over the existing expiry when the
      // originalTransactionId chain matches. A user resubscribing
      // after an old subscription ended has a NEW chain; the old
      // chain's expiresAt belongs to the old purchase and must not
      // bleed into the new row's lifetime.
      const isSameChain =
        subscription.originalTransactionId === txn.originalTransactionId;
      const existingExpiry = isSameChain
        ? (subscription.expiresAt?.getTime() ?? 0)
        : 0;
      const effectiveExpiry = Math.max(existingExpiry, txn.expiresDate);
      subscription.originalTransactionId = txn.originalTransactionId;
      subscription.expiresAt = new Date(effectiveExpiry);
      subscription.environment = txn.environment
        .toLowerCase()
        .includes('sandbox')
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
        // state instead of granting unverified access. Logged so
        // ops can spot Play Console misconfig before users complain.
        await this.recordEvent({
          userId: user.id,
          subscriptionId: subscription.id,
          source: 'play_verify',
          eventType: 'verify',
          productId: dto.productId,
          outcome: 'skipped',
          outcomeReason: 'play_service_account_not_configured',
        });
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
      subscription.revokedAt = state.revokedAt
        ? new Date(state.revokedAt)
        : null;
      subscription.isActive = !state.revokedAt && state.expiryTime > Date.now();
    } else {
      throw new BadRequestException(`Unknown source: ${dto.source}`);
    }

    subscription.plan = subscription.isActive ? 'premium' : 'free';
    user.subscriptionTier = subscription.plan;

    try {
      // Save subscription FIRST. If this throws (unique conflict on
      // originalTransactionId, etc.), we want user.subscriptionTier
      // to remain untouched — otherwise a transfer-on-expired failure
      // would leave the user with tier='premium' but no real entitlement,
      // and the next /me call's ensureSubscription would bootstrap a
      // free-tier row as 'premium' from the in-DB user.subscriptionTier.
      const saved = await this.subscriptionRepo.save(subscription);

      // User tier update second — only runs when subscription row is
      // actually persisted with the right state.
      await this.updateUserTierIfActive(
        user.id,
        subscription.isActive ? 'premium' : 'free',
      );

      // Only emit a verify audit row when the state actually changed
      // (new txn id from a renewal, new expiry, revocation flipped).
      // Duplicate re-verifies of the same row produce no row, keeping
      // the audit feed and dashboards honest.
      const stateChanged =
        saved.storeTransactionId !== priorTxnId ||
        (saved.expiresAt?.getTime() ?? null) !== priorExpiresAt ||
        (saved.revokedAt?.getTime() ?? null) !== priorRevokedAt;

      if (stateChanged) {
        await this.recordEvent({
          userId: user.id,
          subscriptionId: saved.id,
          source: dto.source === 'app_store' ? 'apple_verify' : 'play_verify',
          eventType: 'verify',
          originalTransactionId: saved.originalTransactionId,
          productId: saved.productId,
          outcome: 'applied',
          payload: {
            isActive: saved.isActive,
            expiresAt: saved.expiresAt?.toISOString() ?? null,
            inTrial: saved.inTrial,
            autoRenew: saved.autoRenew,
          },
        });
      }
      return this.serialize(saved, user);
    } catch (e: any) {
      // Postgres unique violation code. Triggered when another
      // LingoLoop user already verified this Apple/Google
      // subscription. TypeORM's QueryFailedError spread-copies the
      // pg driver's properties onto the exception, so `e.code` is
      // usually populated — but check `.driverError.code` too as
      // defense in case a future TypeORM release changes that.
      const pgCode = e.code ?? e.driverError?.code;
      if (e instanceof QueryFailedError && pgCode === '23505') {
        // Resurrection path: the originalTransactionId is held by
        // a row belonging to a different user. If THAT row's
        // subscription is no longer active (expired or revoked),
        // the link is dead weight — clear it and retry, so the
        // user re-subscribing on a new account isn't permanently
        // locked out. We only auto-transfer when:
        //   - the existing owner is a *different* user (same user
        //     would have already updated their own row in-place),
        //   - the existing row isActive=false (not currently paid).
        // Active-on-another-account remains a true conflict (Apple
        // ID shared across two LingoLoop accounts that both want
        // premium) and we keep the original error.
        const otherTxnId = (subscription as any).originalTransactionId as
          | string
          | null;
        if (otherTxnId) {
          const conflicting = await this.subscriptionRepo.findOne({
            where: { originalTransactionId: otherTxnId },
          });
          if (
            conflicting &&
            conflicting.userId !== user.id &&
            !conflicting.isActive
          ) {
            this.logger.warn(
              `Transferring stale originalTransactionId=…${tail(otherTxnId)} from user ${conflicting.userId} → ${user.id} (old sub inactive)`,
            );
            await this.subscriptionRepo.update(
              { id: conflicting.id },
              { originalTransactionId: null },
            );
            // Single retry; if it fails again it's a real conflict
            // (race with another resurrection attempt).
            const saved = await this.subscriptionRepo.save(subscription);
            // Now that the row is persisted under this user, flip the
            // tier — mirrors the happy-path ordering (save before tier
            // update) so a transfer that ultimately fails never leaves
            // tier='premium' stuck.
            await this.updateUserTierIfActive(
              user.id,
              saved.isActive ? 'premium' : 'free',
            );
            await this.recordEvent({
              userId: user.id,
              subscriptionId: saved.id,
              source:
                dto.source === 'app_store' ? 'apple_verify' : 'play_verify',
              eventType: 'verify_transferred',
              originalTransactionId: saved.originalTransactionId,
              productId: saved.productId,
              outcome: 'applied',
              outcomeReason: `transferred_from_${conflicting.userId}`,
              payload: {
                isActive: saved.isActive,
                expiresAt: saved.expiresAt?.toISOString() ?? null,
                fromUserId: conflicting.userId,
              },
            });
            return this.serialize(saved, user);
          }
        }
        const storeName =
          dto.source === 'app_store' ? 'Apple ID' : 'Google 계정';
        throw new ConflictException(
          `이 ${storeName}에는 이미 다른 LingoLoop 계정으로 premium이 연결돼 있어요. ` +
            '한 결제 계정으로는 한 LingoLoop 계정만 premium을 받을 수 있어요. ' +
            '다른 LingoLoop 계정에서 사용 중이라면 그 계정으로 로그인하시거나, ' +
            '구독 화면의 "구독 안내"에서 자세한 방법을 확인해 주세요.',
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
      await this.recordEvent({
        source: 'apple_webhook',
        eventType: `${note.notificationType}${note.subtype ? '/' + note.subtype : ''}`,
        notificationUuid: note.notificationUUID,
        outcome: 'skipped',
        outcomeReason: 'no_transaction',
      });
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
      await this.recordEvent({
        source: 'apple_webhook',
        eventType: `${note.notificationType}${note.subtype ? '/' + note.subtype : ''}`,
        notificationUuid: note.notificationUUID,
        originalTransactionId: txn.originalTransactionId,
        productId: txn.productId,
        outcome: 'skipped',
        outcomeReason: 'unknown_original_transaction_id',
      });
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
      await this.recordEvent({
        userId: sub.userId,
        subscriptionId: sub.id,
        source: 'apple_webhook',
        eventType: `${note.notificationType}${note.subtype ? '/' + note.subtype : ''}`,
        notificationUuid: note.notificationUUID,
        originalTransactionId: txn.originalTransactionId,
        productId: txn.productId,
        outcome: 'skipped',
        outcomeReason: 'user_deleted_or_inactive',
      });
      return;
    }

    // Apple gives ~12 hours from CONSUMPTION_REQUEST to respond with
    // usage info; after that they decide on the refund alone and
    // default to grant. The notification is informational — don't
    // mutate subscription state from it, just send usage data and
    // record an audit row. State changes follow on a subsequent
    // REFUND or DID_RENEW notification depending on Apple's decision.
    if (note.notificationType === 'CONSUMPTION_REQUEST') {
      await this.respondToConsumptionRequest(sub, owner, txn, note);
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
      await this.recordEvent({
        userId: sub.userId,
        subscriptionId: sub.id,
        source: 'apple_webhook',
        eventType: `${note.notificationType}${note.subtype ? '/' + note.subtype : ''}`,
        notificationUuid: note.notificationUUID,
        originalTransactionId: txn.originalTransactionId,
        productId: txn.productId,
        outcome: 'skipped',
        outcomeReason: 'past_cycle',
        payload: {
          txnTransactionId: txn.transactionId,
          txnExpiresDate: txn.expiresDate,
          currentExpiresAt: sub.expiresAt.toISOString(),
        },
      });
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
    await this.recordEvent({
      userId: sub.userId,
      subscriptionId: sub.id,
      source: 'apple_webhook',
      eventType: `${note.notificationType}${note.subtype ? '/' + note.subtype : ''}`,
      notificationUuid: note.notificationUUID,
      originalTransactionId: txn.originalTransactionId,
      productId: txn.productId,
      outcome: 'applied',
      payload: {
        expiresAt: expiresAt.toISOString(),
        isActive,
        autoRenew,
        revokedAt: revokedAt?.toISOString() ?? null,
        gracePeriodExpiresDate: note.renewal?.gracePeriodExpiresDate ?? null,
      },
    });
    // 운영 이벤트 admin 알림 — type 기반 분기. 갱신(DID_RENEW)은
    // 자동이라 노이즈 제외. SUBSCRIBED = 신규 결제, REFUND/REVOKE =
    // 환불, DID_CHANGE_RENEWAL_STATUS + AUTO_RENEW_DISABLED = 자동
    // 갱신 해지.
    await this.maybeNotifyAdminsApple(owner, note, txn);
  }

  private async maybeNotifyAdminsApple(
    owner: User,
    note: { notificationType: string; subtype?: string },
    txn: { productId: string },
  ): Promise<void> {
    const userLabel = owner.nickname?.trim() || owner.email || owner.id;
    const product = txn.productId;
    switch (note.notificationType) {
      case 'SUBSCRIBED':
        await this.notificationsService.notifyAdmins({
          title: '신규 구독 결제',
          body: `${userLabel} 회원이 신규 구독을 시작했습니다. (Apple · ${product})`,
          eventType: 'purchase',
          extra: { userId: owner.id, store: 'app_store' },
        });
        break;
      case 'DID_RENEW':
        // 자동 갱신 결제 발생 — 매출 시그널이라 admin이 알아야 함.
        await this.notificationsService.notifyAdmins({
          title: '구독 자동 갱신',
          body: `${userLabel} 회원의 구독이 자동 갱신되었습니다. (Apple · ${product})`,
          eventType: 'renew',
          extra: { userId: owner.id, store: 'app_store' },
        });
        break;
      case 'DID_FAIL_TO_RENEW':
        // 결제 실패 — Apple은 재시도하다 BILLING_RECOVERY로 회복하거나
        // EXPIRED로 끝남. 첫 실패 시점에 admin에 알림.
        await this.notificationsService.notifyAdmins({
          title: '구독 갱신 결제 실패',
          body: `${userLabel} 회원의 구독 갱신 결제가 실패했습니다. (Apple · ${product})`,
          eventType: 'fail',
          extra: { userId: owner.id, store: 'app_store' },
        });
        break;
      case 'REFUND':
      case 'REVOKE':
        await this.notificationsService.notifyAdmins({
          title: '구독 환불',
          body: `${userLabel} 회원의 구독이 환불 처리되었습니다. (Apple · ${product})`,
          eventType: 'refund',
          extra: { userId: owner.id, store: 'app_store' },
        });
        break;
      case 'DID_CHANGE_RENEWAL_STATUS':
        if (note.subtype === 'AUTO_RENEW_DISABLED') {
          await this.notificationsService.notifyAdmins({
            title: '구독 자동 갱신 해지',
            body: `${userLabel} 회원이 자동 갱신을 해지했습니다. (Apple · ${product})`,
            eventType: 'cancel',
            extra: { userId: owner.id, store: 'app_store' },
          });
        } else if (note.subtype === 'AUTO_RENEW_ENABLED') {
          // 사용자가 해지했다가 다시 켬 — '재구독' 시그널.
          await this.notificationsService.notifyAdmins({
            title: '구독 자동 갱신 재개',
            body: `${userLabel} 회원이 자동 갱신을 다시 켰습니다. (Apple · ${product})`,
            eventType: 'resume',
            extra: { userId: owner.id, store: 'app_store' },
          });
        }
        break;
    }
  }

  /**
   * Google Play Real-time Developer Notification handler. Pub/Sub
   * pushes a JSON envelope; we decode the inner notification and
   * re-fetch authoritative state from the Play Developer API instead
   * of trusting fields in the message itself.
   */
  async applyGoogleNotification(data: any): Promise<void> {
    const buf =
      typeof data?.message?.data === 'string'
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

    const state = await this.googlePlay.verifyPurchaseToken(sn.purchaseToken);
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
      await this.recordEvent({
        source: 'google_webhook',
        eventType: String(sn.notificationType),
        notificationUuid: messageId,
        originalTransactionId: sn.purchaseToken,
        productId: state.productId,
        outcome: 'skipped',
        outcomeReason: 'unknown_purchase_token',
      });
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
    await this.recordEvent({
      userId: sub.userId,
      subscriptionId: sub.id,
      source: 'google_webhook',
      eventType: String(sn.notificationType),
      notificationUuid: messageId,
      originalTransactionId: sn.purchaseToken,
      productId: state.productId,
      outcome: 'applied',
      payload: {
        state: state.state,
        isActive,
        autoRenew: state.autoRenew,
        inTrial: state.inTrial,
        expiryTime: state.expiryTime,
      },
    });
    // 운영 이벤트 admin 알림. Play의 SubscriptionNotification.notificationType
    // 정수 코드: 3=CANCELED, 4=PURCHASED. RECOVERED(1)/RENEWED(2)는 자동
    // 갱신이라 노이즈 제외. voidedPurchaseNotification은 별도 분기
    // (revokeByPurchaseToken)에서 처리.
    const userLabel = owner.nickname?.trim() || owner.email || owner.id;
    if (sn.notificationType === 4) {
      await this.notificationsService.notifyAdmins({
        title: '신규 구독 결제',
        body: `${userLabel} 회원이 신규 구독을 시작했습니다. (Google · ${state.productId})`,
        eventType: 'purchase',
        extra: { userId: owner.id, store: 'play_store' },
      });
    } else if (sn.notificationType === 2) {
      // RENEWED — 매출 시그널.
      await this.notificationsService.notifyAdmins({
        title: '구독 자동 갱신',
        body: `${userLabel} 회원의 구독이 자동 갱신되었습니다. (Google · ${state.productId})`,
        eventType: 'renew',
        extra: { userId: owner.id, store: 'play_store' },
      });
    } else if (sn.notificationType === 1) {
      // RECOVERED — 결제 실패 후 회복. 사용자가 결제 수단을 고쳤거나
      // Google 시스템이 재시도 성공한 경우. 매출 부활 시그널.
      await this.notificationsService.notifyAdmins({
        title: '구독 결제 회복',
        body: `${userLabel} 회원의 구독 결제가 회복되었습니다. (Google · ${state.productId})`,
        eventType: 'resume',
        extra: { userId: owner.id, store: 'play_store' },
      });
    } else if (sn.notificationType === 3) {
      await this.notificationsService.notifyAdmins({
        title: '구독 자동 갱신 해지',
        body: `${userLabel} 회원이 자동 갱신을 해지했습니다. (Google · ${state.productId})`,
        eventType: 'cancel',
        extra: { userId: owner.id, store: 'play_store' },
      });
    } else if (sn.notificationType === 5) {
      // ON_HOLD — 결제 실패로 즉시 grace 진입. admin에게도 알림.
      await this.notificationsService.notifyAdmins({
        title: '구독 결제 실패',
        body: `${userLabel} 회원의 구독 결제가 실패했습니다. (Google · ${state.productId})`,
        eventType: 'fail',
        extra: { userId: owner.id, store: 'play_store' },
      });
    }
  }

  /**
   * Answers Apple's CONSUMPTION_REQUEST by computing usage stats for
   * `owner` against `sub`'s lifetime and POSTing them back. Pure
   * read-then-PUT — no DB writes beyond the audit event. Failures
   * never propagate: if config is missing, the API call fails, or
   * the metrics query throws, we log + record a `skipped` event so
   * ops can see WHY without delaying any refund decision.
   *
   * Apple uses the answer as input to their refund decision. Per
   * Apple's guidance, we set:
   *   customerConsented=true — covered by our ToS (section on refunds).
   *   refundPreference=0 (no preference) — let Apple decide based on
   *     our usage data + their abuse signals; sending "prefer decline"
   *     on every request is what gets accounts flagged.
   */
  private async respondToConsumptionRequest(
    sub: Subscription,
    owner: User,
    txn: {
      originalTransactionId: string;
      transactionId: string;
      productId: string;
      environment: string;
    },
    note: {
      notificationUUID: string;
      notificationType: string;
      subtype?: string;
    },
  ): Promise<void> {
    if (!this.appleAppStoreApi.isConfigured) {
      this.logger.warn(
        `CONSUMPTION_REQUEST received but App Store Server API not configured — skipping. uuid=${note.notificationUUID}`,
      );
      await this.recordEvent({
        userId: sub.userId,
        subscriptionId: sub.id,
        source: 'apple_webhook',
        eventType: 'CONSUMPTION_REQUEST',
        notificationUuid: note.notificationUUID,
        originalTransactionId: txn.originalTransactionId,
        productId: txn.productId,
        outcome: 'skipped',
        outcomeReason: 'appstore_api_not_configured',
      });
      return;
    }

    let metrics: ConsumptionMetrics;
    try {
      metrics = await this.computeConsumptionMetrics(sub, owner);
    } catch (e: any) {
      this.logger.error(
        `computeConsumptionMetrics failed for user ${sub.userId}: ${e.message}`,
      );
      await this.recordEvent({
        userId: sub.userId,
        subscriptionId: sub.id,
        source: 'apple_webhook',
        eventType: 'CONSUMPTION_REQUEST',
        notificationUuid: note.notificationUUID,
        originalTransactionId: txn.originalTransactionId,
        productId: txn.productId,
        outcome: 'skipped',
        outcomeReason: 'metrics_query_failed',
      });
      return;
    }

    const body: ConsumptionRequestBody = {
      customerConsented: true,
      consumptionStatus: metrics.consumptionStatus,
      platform: 1, // 1 = Apple
      sampleContentProvided: false,
      deliveryStatus: 0, // delivered, no issue
      appAccountToken: AppleAppStoreApiService.zeroAppAccountToken(),
      accountTenure: AppleAppStoreApiService.accountTenureBucket(
        metrics.accountAgeDays,
      ),
      playTime: AppleAppStoreApiService.playTimeBucket(metrics.playTimeMinutes),
      lifetimeDollarsRefunded: AppleAppStoreApiService.dollarsBucket(
        metrics.lifetimeRefundsUsd,
      ),
      lifetimeDollarsPurchased: AppleAppStoreApiService.dollarsBucket(
        metrics.lifetimePurchasesUsd,
      ),
      userStatus: 1, // active
      refundPreference: 0, // no preference — let Apple decide on the merits
    };

    const env = txn.environment.toLowerCase().includes('sandbox')
      ? 'sandbox'
      : 'production';
    const ok = await this.appleAppStoreApi.sendConsumptionInfo(
      txn.originalTransactionId,
      body,
      env,
    );

    await this.recordEvent({
      userId: sub.userId,
      subscriptionId: sub.id,
      source: 'apple_webhook',
      eventType: 'CONSUMPTION_REQUEST',
      notificationUuid: note.notificationUUID,
      originalTransactionId: txn.originalTransactionId,
      productId: txn.productId,
      outcome: ok ? 'applied' : 'skipped',
      outcomeReason: ok ? null : 'appstore_api_call_failed',
      payload: { body, env },
    });
  }

  /**
   * Pulls the raw counts Apple's ConsumptionRequest enums expect — kept
   * separate so the math is easy to read and unit-testable. All values
   * are approximations:
   *  - playTime: 30s per completed sentence + 60s per quiz attempt.
   *    We don't track per-session timing, so this is the best signal
   *    we have for "how much of the service did they consume?".
   *  - lifetimePurchasesUsd: months since first paid subscription
   *    event × ~$3 (our monthly equivalent). Subscription events table
   *    is our ground truth — if it's empty, fall back to the
   *    subscription row's createdAt.
   *  - lifetimeRefundsUsd: count of past REFUND / REVOKE / voided
   *    events × ~$3.
   */
  private async computeConsumptionMetrics(
    sub: Subscription,
    owner: User,
  ): Promise<ConsumptionMetrics> {
    const dayMs = 86_400_000;
    const accountAgeDays = Math.max(
      0,
      Math.floor((Date.now() - owner.createdAt.getTime()) / dayMs),
    );

    // Use raw queries to avoid pulling the assignments/quiz repos into
    // this module. The cost of a tiny coupling to table names is much
    // less than the cost of a cross-module DI graph for one path.
    const sentenceRows = await this.subscriptionRepo.query(
      `SELECT COUNT(*)::int AS n FROM ll_daily_assignments
       WHERE user_id = $1 AND status = 'completed'`,
      [sub.userId],
    );
    const quizRows = await this.subscriptionRepo.query(
      `SELECT COUNT(*)::int AS n FROM ll_quiz_attempts
       WHERE user_id = $1`,
      [sub.userId],
    );
    const completedSentences = Number(sentenceRows?.[0]?.n ?? 0);
    const quizAttempts = Number(quizRows?.[0]?.n ?? 0);
    const playTimeMinutes = Math.floor(
      (completedSentences * 30 + quizAttempts * 60) / 60,
    );
    const consumptionStatus: ConsumptionRequestBody['consumptionStatus'] =
      completedSentences === 0 && quizAttempts === 0 ? 1 : 3;

    // Months elapsed since the first paid event (or sub row creation as
    // a fallback). Multiplied by our headline price (~$3/mo for the
    // ₩3,900 tier — Apple's enum is bucketed coarse enough that
    // small rounding doesn't matter).
    const firstPaidRow = await this.subscriptionRepo.query(
      `SELECT MIN(occurred_at) AS first_at
         FROM ll_subscription_events
         WHERE subscription_id = $1
           AND outcome = 'applied'
           AND (source IN ('apple_verify','play_verify')
                OR event_type IN ('SUBSCRIBED','DID_RENEW'))`,
      [sub.id],
    );
    const firstPaidAt: Date | null = firstPaidRow?.[0]?.first_at
      ? new Date(firstPaidRow[0].first_at)
      : sub.createdAt;
    const monthsActive = Math.max(
      1,
      Math.floor((Date.now() - firstPaidAt.getTime()) / (30 * dayMs)) + 1,
    );
    const lifetimePurchasesUsd = monthsActive * 3;

    // Past refund / revoke / voided count for THIS user. We sum across
    // subscriptions (rare but possible if a user resubscribes after
    // refund) — Apple's metric is per-account, not per-subscription.
    const refundRows = await this.subscriptionRepo.query(
      `SELECT COUNT(*)::int AS n
         FROM ll_subscription_events
        WHERE user_id = $1
          AND outcome = 'applied'
          AND (event_type IN ('REFUND','REVOKE','voided_purchase')
               OR event_type LIKE 'REFUND/%'
               OR event_type LIKE 'REVOKE/%')`,
      [sub.userId],
    );
    const pastRefunds = Number(refundRows?.[0]?.n ?? 0);
    const lifetimeRefundsUsd = pastRefunds * 3;

    return {
      accountAgeDays,
      playTimeMinutes,
      consumptionStatus,
      lifetimePurchasesUsd,
      lifetimeRefundsUsd,
    };
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
      this.logger.warn(`Google void for deleted user ${sub.userId}, skipping`);
      return;
    }
    // Idempotency: 동일 voided notification이 Pub/Sub re-delivery로
    // 두 번 도착해도 revokedAt 시각 덮어쓰기 + audit row 중복 안 됨.
    // 이미 revoked면 affected=0 → tier/audit 모두 skip.
    const result = await this.subscriptionRepo.update(
      { id: sub.id, revokedAt: IsNull() },
      {
        revokedAt: new Date(),
        autoRenew: false,
        isActive: false,
        plan: 'free',
      },
    );
    if (!result.affected) {
      this.logger.log(
        `Google void messageId=${messageId} ignored (already revoked at ${sub.revokedAt?.toISOString() ?? '?'})`,
      );
      return;
    }
    await this.updateUserTierIfActive(sub.userId, 'free');
    await this.recordEvent({
      userId: sub.userId,
      subscriptionId: sub.id,
      source: 'google_voided',
      eventType: 'voided_purchase',
      notificationUuid: messageId,
      originalTransactionId: purchaseToken,
      outcome: 'applied',
    });
    // voided purchase = 환불(또는 chargeback). admin 알림.
    const userLabel = owner.nickname?.trim() || owner.email || owner.id;
    await this.notificationsService.notifyAdmins({
      title: '구독 환불',
      body: `${userLabel} — ${sub.productId ?? 'unknown'} (Google void)`,
      eventType: 'refund',
      extra: { userId: owner.id, store: 'play_store' },
    });
  }

  /**
   * Best-effort append to the audit log. Wrapped in try/catch so a
   * logging failure can never block the real subscription state
   * write — the log is for forensics, not correctness.
   */
  private async recordEvent(e: Partial<SubscriptionEvent>): Promise<void> {
    try {
      await this.eventsRepo.insert({
        userId: e.userId ?? null,
        subscriptionId: e.subscriptionId ?? null,
        source: e.source ?? 'unknown',
        eventType: e.eventType ?? null,
        notificationUuid: e.notificationUuid ?? null,
        originalTransactionId: e.originalTransactionId ?? null,
        productId: e.productId ?? null,
        outcome: e.outcome ?? 'applied',
        outcomeReason: e.outcomeReason ?? null,
        payload: e.payload ?? null,
      });
    } catch (err: any) {
      this.logger.warn(`recordEvent failed: ${err.message}`);
    }
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
      return;
    }
    if (tier === 'free') {
      await this.notificationsService.downgradeSettingsForFreePlan(userId);
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
  @Cron(CronExpression.EVERY_HOUR, { waitForCompletion: true })
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
      // Re-check the expiry predicate in the UPDATE itself so we don't
      // clobber a row a webhook just renewed between `find()` and
      // here. Without this WHERE clause: cron loads row at T=0 with
      // expiresAt past; DID_RENEW at T+1 bumps expiresAt 30 days
      // forward + flips plan=premium; cron at T+2 writes
      // isActive=false anyway → user loses the cycle they just paid
      // for, until next /verify or webhook.
      const result = await this.subscriptionRepo.update(
        {
          id: sub.id,
          isActive: true,
          expiresAt: LessThan(new Date()),
        },
        { isActive: false, plan: 'free' },
      );
      if (result.affected) {
        await this.updateUserTierIfActive(sub.userId, 'free');
        await this.recordEvent({
          userId: sub.userId,
          subscriptionId: sub.id,
          source: 'sweep',
          eventType: 'sweep_expired',
          originalTransactionId: sub.originalTransactionId,
          productId: sub.productId,
          outcome: 'applied',
          payload: {
            expiresAt: sub.expiresAt?.toISOString() ?? null,
          },
        });
      }
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
