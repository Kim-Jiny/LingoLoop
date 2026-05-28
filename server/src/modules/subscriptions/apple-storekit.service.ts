import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { importX509, jwtVerify, decodeProtectedHeader } from 'jose';
import { X509Certificate } from 'node:crypto';

/**
 * Decoded StoreKit 2 JWSTransaction payload. The client receives one of
 * these on every purchase / renewal / refund event; the server checks
 * the signature, then trusts the contents.
 *
 * Apple's spec: https://developer.apple.com/documentation/appstoreserverapi/jwstransactiondecodedpayload
 */
/**
 * Decoded App Store Server Notification V2 payload. Apple sends one
 * of these every time the subscription state changes (renew, expire,
 * refund, billing retry, etc.). The inner signedTransactionInfo is
 * itself a JWS we re-verify.
 *
 * Apple's spec:
 * https://developer.apple.com/documentation/appstoreservernotifications/responsebodyv2decodedpayload
 */
export interface AppleNotification {
  notificationType: string; // e.g. SUBSCRIBED, DID_RENEW, EXPIRED, REVOKE, REFUND
  subtype?: string; // INITIAL_BUY, RESUBSCRIBE, AUTO_RENEW_DISABLED, ...
  notificationUUID: string;
  version: string;
  signedDate: number; // ms
  data?: {
    appAppleId?: number;
    bundleId: string;
    environment: string; // 'Sandbox' | 'Production'
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
  /** Verified transaction info, decoded from `data.signedTransactionInfo`. */
  transaction?: AppleTransaction;
  /** Verified renewal info, decoded from `data.signedRenewalInfo`. */
  renewal?: AppleRenewalInfo;
}

/**
 * Decoded App Store renewal info. Apple sends this alongside the
 * transaction in renewal-related notifications; it carries the
 * authoritative auto-renew state (the notification subtype only
 * conveys this on DID_CHANGE_RENEWAL_STATUS).
 *
 * Spec:
 * https://developer.apple.com/documentation/appstoreserverapi/jwsrenewalinfodecodedpayload
 */
export interface AppleRenewalInfo {
  /** 0 = off, 1 = on. THE source of truth for whether renewal will fire. */
  autoRenewStatus: 0 | 1;
  autoRenewProductId: string;
  productId: string;
  originalTransactionId: string;
  /** When the user disabled auto-renew, in ms (omitted if still on). */
  recentSubscriptionStartDate?: number;
  /** 'WILL_NOT_RENEW' etc — set by Apple when state changes. */
  expirationIntent?: number;
  gracePeriodExpiresDate?: number;
  isInBillingRetryPeriod?: boolean;
}

export interface AppleTransaction {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  bundleId: string;
  /** ms since epoch */
  purchaseDate: number;
  /** ms since epoch */
  expiresDate: number;
  /** 'PRODUCTION' | 'Sandbox' */
  environment: string;
  /** true if this is the introductory free trial period */
  offerType?: number; // 1 = introductory, 2 = promotional, 3 = subscription offer code
  /**
   * 'FREE_TRIAL' | 'PAY_AS_YOU_GO' | 'PAY_UP_FRONT'. Only present on
   * the JWSTransaction when an offer was redeemed. Distinguishes a
   * free trial from a paid intro offer (both have offerType=1).
   */
  offerDiscountType?: string;
  /** ms since epoch — set when Apple revokes/refunds */
  revocationDate?: number;
  inAppOwnershipType?: string;
  type?: string; // 'Auto-Renewable Subscription' for our case
}

/**
 * Verifies StoreKit 2 JWSTransaction strings from the client.
 *
 * Apple signs each JWSTransaction with the Apple Root CA → Apple WWDR
 * G6 → leaf cert chain embedded in the JWT's `x5c` header. We verify
 * the chain back to a trusted Apple root, then use the leaf's public
 * key to verify the JWT signature itself.
 *
 * Apple roots are pinned by fingerprint — Apple rotates them rarely
 * but the bundled list below covers production as of 2026-05. Refresh
 * from https://www.apple.com/certificateauthority/ when Apple
 * publishes a new root.
 */
@Injectable()
export class AppleStorekitService {
  private readonly logger = new Logger(AppleStorekitService.name);
  private readonly bundleId: string;

  /** Apple-issued root cert that anchors the StoreKit 2 chain. */
  private static readonly APPLE_ROOT_CA_G3_PEM =
    `-----BEGIN CERTIFICATE-----\n` +
    `MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS\n` +
    `QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u\n` +
    `IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN\n` +
    `MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS\n` +
    `b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y\n` +
    `aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49\n` +
    `AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf\n` +
    `TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517\n` +
    `IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr\n` +
    `MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA\n` +
    `MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4\n` +
    `at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM\n` +
    `6BgD56KyKA==\n` +
    `-----END CERTIFICATE-----\n`;

  constructor(config: ConfigService) {
    this.bundleId = config.get<string>('APPLE_CLIENT_ID', 'com.jiny.lingoloop');
    // Surface the configured bundle id at boot so a misconfigured
    // APPLE_CLIENT_ID env doesn't quietly drop every Apple webhook
    // as "permanent / bundle id mismatch" — the resulting 200-drops
    // are easy to miss in a busy log stream.
    this.logger.log(`Apple bundle id pinned to: ${this.bundleId}`);
  }

  /**
   * Verifies the JWS, walks the x5c cert chain back to a pinned Apple
   * root, and returns the decoded transaction payload. Throws on any
   * signature, chain, bundle-id, or product-id mismatch — the caller
   * should never trust the contents otherwise.
   */
  async verifyTransaction(jws: string): Promise<AppleTransaction> {
    const txn = (await this.verifyAndDecode(
      jws,
    )) as unknown as AppleTransaction;
    // Hand-check the business fields we actually care about. JWS
    // signature was already verified — these are shape checks against
    // an unexpected payload structure (Apple field rename, malformed
    // sandbox response, etc.).
    if (txn.bundleId !== this.bundleId) {
      throw new Error(
        `Bundle id mismatch: ${txn.bundleId} != ${this.bundleId}`,
      );
    }
    if (!txn.transactionId || !txn.originalTransactionId) {
      throw new Error('Transaction id fields missing');
    }
    if (!txn.productId) {
      throw new Error('productId missing');
    }
    // expiresDate drives every downstream check (isActive, sweep,
    // past-cycle guard). If it's missing or non-numeric, all of
    // those silently flip wrong — `new Date(undefined)` is Invalid
    // Date and `undefined > Date.now()` is false. Fail loud.
    if (
      typeof txn.expiresDate !== 'number' ||
      !Number.isFinite(txn.expiresDate)
    ) {
      throw new Error('Apple JWS expiresDate missing or invalid');
    }
    return txn;
  }

  /**
   * Verifies an App Store Server Notification V2 payload. Apple POSTs
   * `{ signedPayload: "JWS..." }` to our webhook on every subscription
   * state change. We verify the outer signature, then verify the
   * inner signedTransactionInfo (also JWS) so the caller can trust
   * both the event metadata and the underlying transaction fields.
   */
  async verifyNotification(signedPayload: string): Promise<AppleNotification> {
    const notification = (await this.verifyAndDecode(
      signedPayload,
    )) as unknown as AppleNotification;

    if (
      notification.data?.bundleId &&
      notification.data.bundleId !== this.bundleId
    ) {
      throw new Error(
        `Notification bundle id mismatch: ${notification.data.bundleId}`,
      );
    }

    if (notification.data?.signedTransactionInfo) {
      notification.transaction = await this.verifyTransaction(
        notification.data.signedTransactionInfo,
      );
    }
    if (notification.data?.signedRenewalInfo) {
      // Same cert chain as the transaction; reuse the same verifier
      // so signature + chain are validated identically.
      notification.renewal = (await this.verifyAndDecode(
        notification.data.signedRenewalInfo,
      )) as unknown as AppleRenewalInfo;
    }
    return notification;
  }

  /**
   * Verify-then-decode for any Apple JWS. Shared by `verifyTransaction`
   * (where the payload is a transaction) and `verifyNotification`
   * (where it's a notification). Signature, alg, and cert-chain checks
   * live here so they stay in lockstep.
   */
  private async verifyAndDecode(jws: string): Promise<Record<string, unknown>> {
    const header = decodeProtectedHeader(jws) as {
      x5c?: string[];
      alg?: string;
    };
    if (!header.x5c || header.x5c.length < 2) {
      throw new Error('JWS missing x5c chain');
    }
    if (header.alg !== 'ES256') {
      throw new Error(`Unexpected JWS alg ${header.alg}`);
    }

    const chain = header.x5c.map(
      (b64) => new X509Certificate(Buffer.from(b64, 'base64')),
    );
    this.verifyChainAgainstAppleRoot(chain);

    const leafPem = certToPem(chain[0]);
    const leafKey = await importX509(leafPem, 'ES256');
    const { payload } = await jwtVerify(jws, leafKey, {});
    return payload as Record<string, unknown>;
  }

  private verifyChainAgainstAppleRoot(chain: X509Certificate[]) {
    // Each cert must be signed by the next; the top must be signed by
    // (or equal to) the pinned Apple root. node:crypto exposes
    // X509Certificate.verify(publicKey) — we walk pairs.
    const root = new X509Certificate(AppleStorekitService.APPLE_ROOT_CA_G3_PEM);
    const fullChain = [...chain];
    // Some JWS responses already include the root as the last element;
    // if not, append our pinned copy so the loop closes.
    const last = fullChain[fullChain.length - 1];
    if (!buffersEqual(last.raw, root.raw)) fullChain.push(root);

    for (let i = 0; i < fullChain.length - 1; i++) {
      const child = fullChain[i];
      const parent = fullChain[i + 1];
      if (!child.verify(parent.publicKey)) {
        throw new Error(`Cert chain broken at index ${i}`);
      }
      // Prefer the Date objects (Node 18+) over Date.parse on the
      // locale-formatted string — Date.parse returns NaN on a few
      // formats Apple has used historically, and NaN comparisons
      // silently pass.
      const now = Date.now();
      const from =
        (
          child as unknown as { validFromDate?: Date }
        ).validFromDate?.getTime() ?? Date.parse(child.validFrom);
      const to =
        (child as unknown as { validToDate?: Date }).validToDate?.getTime() ??
        Date.parse(child.validTo);
      if (!Number.isFinite(from) || !Number.isFinite(to)) {
        throw new Error(`Cert at index ${i} has unparseable validity dates`);
      }
      if (from > now || to < now) {
        throw new Error(`Cert at index ${i} is outside validity window`);
      }
    }

    // The chain's top must match the pinned Apple root by raw bytes.
    if (!buffersEqual(fullChain[fullChain.length - 1].raw, root.raw)) {
      throw new Error('Chain does not anchor to the pinned Apple root');
    }
  }
}

function certToPem(c: X509Certificate): string {
  const b64 = c.raw.toString('base64');
  // Re-wrap into 64-char lines per PEM spec.
  const wrapped = b64.match(/.{1,64}/g)!.join('\n');
  return `-----BEGIN CERTIFICATE-----\n${wrapped}\n-----END CERTIFICATE-----\n`;
}

function buffersEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return a.equals(b);
}
