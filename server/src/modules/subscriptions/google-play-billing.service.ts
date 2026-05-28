import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, androidpublisher_v3 } from 'googleapis';

/**
 * Snapshot of a Google Play subscription pulled from
 * androidpublisher.purchases.subscriptionsv2.get. We only surface the
 * fields the rest of the app cares about — the full API response is
 * much larger and full of legacy fields.
 */
export interface GoogleSubscriptionState {
  productId: string;
  purchaseToken: string;
  /** ms since epoch */
  startTime: number;
  /** ms since epoch — next renewal / final cycle end */
  expiryTime: number;
  /** 'ACTIVE' | 'CANCELED' | 'IN_GRACE_PERIOD' | 'ON_HOLD' | 'PAUSED' | 'EXPIRED' */
  state: string;
  autoRenew: boolean;
  inTrial: boolean;
  /** Set when the user / Google revokes the subscription. */
  revokedAt: number | null;
  environment: 'production' | 'sandbox';
}

/**
 * Verifies Google Play Billing v6 purchase tokens.
 *
 * Hits androidpublisher.purchases.subscriptionsv2.get with a service-
 * account-signed credential. The service account needs the
 * "View financial data" / "Manage orders and subscriptions" permission
 * granted on the Play Console > Users & permissions page.
 *
 * Env:
 *   GOOGLE_PLAY_PACKAGE_NAME      — e.g. com.jiny.lingoloop
 *   GOOGLE_PLAY_SERVICE_ACCOUNT   — full JSON of the service account
 *                                   key (single line, escaped \n is OK).
 *                                   When missing, all verifications
 *                                   fail closed.
 */
@Injectable()
export class GooglePlayBillingService {
  private readonly logger = new Logger(GooglePlayBillingService.name);
  private readonly packageName: string;
  private readonly publisher?: androidpublisher_v3.Androidpublisher;

  constructor(config: ConfigService) {
    this.packageName = config.get<string>(
      'GOOGLE_PLAY_PACKAGE_NAME',
      'com.jiny.lingoloop',
    );

    const rawKey = config.get<string>('GOOGLE_PLAY_SERVICE_ACCOUNT');
    if (!rawKey) {
      this.logger.warn(
        'GOOGLE_PLAY_SERVICE_ACCOUNT not set — Play purchases will fail verification.',
      );
      return;
    }

    try {
      // Accept both raw JSON and \n-escaped single line.
      const json = JSON.parse(
        rawKey.includes('\n') ? rawKey : rawKey.replace(/\\n/g, '\n'),
      );
      const auth = new google.auth.GoogleAuth({
        credentials: json,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      });
      this.publisher = google.androidpublisher({ version: 'v3', auth });
    } catch (e: any) {
      this.logger.error(
        `Failed to parse GOOGLE_PLAY_SERVICE_ACCOUNT: ${e.message}`,
      );
    }
  }

  /**
   * Looks up the current subscription state for a purchaseToken.
   * Returns null when the service account is not configured;
   * throws on explicit Google errors. The returned `productId` is
   * the authoritative one from Google's response — caller is
   * responsible for matching it against their known-products list.
   */
  async verifyPurchaseToken(
    purchaseToken: string,
  ): Promise<GoogleSubscriptionState | null> {
    if (!this.publisher) return null;

    const res = await this.publisher.purchases.subscriptionsv2.get({
      packageName: this.packageName,
      token: purchaseToken,
    });

    const sub = res.data;
    const lineItem = sub.lineItems?.[0];
    if (!lineItem?.productId) {
      throw new BadRequestException('Google subscription has no line items');
    }
    const productId = lineItem.productId;

    const startMs = parseIso(sub.startTime) ?? Date.now();
    const expiryMs = parseIso(lineItem.expiryTime) ?? 0;
    // Trial / intro offers carry an offerId on the line item.
    const inTrial = !!lineItem.offerDetails?.offerId;
    const state = sub.subscriptionState ?? 'SUBSCRIPTION_STATE_UNSPECIFIED';
    // autoRenew flows from the autoRenewingPlan; if the user canceled,
    // Google flips autoRenewEnabled to false even though the state is
    // still CANCELED-with-paid-period.
    const autoRenew = !!lineItem.autoRenewingPlan?.autoRenewEnabled;
    // Whitelist the states that GRANT entitlement, not the ones that
    // revoke. With a deny-list, any new state Google adds in v7+
    // silently grants access. With this allow-list:
    //   ACTIVE             — paid up
    //   IN_GRACE_PERIOD    — billing retry, user still entitled per spec
    //   CANCELED           — user canceled but cycle hasn't ended yet
    // Everything else (PENDING / ON_HOLD / PAUSED / EXPIRED /
    // PENDING_PURCHASE_CANCELED / UNSPECIFIED / future values) →
    // revoke. CANCELED still relies on expiryTime to cut off access
    // when the paid period ends.
    const grantsAccess =
      state === 'SUBSCRIPTION_STATE_ACTIVE' ||
      state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' ||
      state === 'SUBSCRIPTION_STATE_CANCELED';
    const revokedAt = grantsAccess ? null : Date.now();
    const environment = sub.testPurchase != null ? 'sandbox' : 'production';

    return {
      productId,
      purchaseToken,
      startTime: startMs,
      expiryTime: expiryMs,
      state: state.replace('SUBSCRIPTION_STATE_', ''),
      autoRenew,
      inTrial,
      revokedAt,
      environment,
    };
  }
}

/** Returns ms-since-epoch from an RFC3339 string, or null on failure. */
function parseIso(s: string | null | undefined): number | null {
  if (!s) return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}
