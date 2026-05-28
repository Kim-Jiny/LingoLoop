import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, importPKCS8 } from 'jose';

/**
 * Client for the App Store Server API. Distinct from the StoreKit
 * notification verifier (apple-storekit.service.ts) — that one validates
 * incoming JWS payloads with Apple's certs; this one SIGNS outgoing
 * requests with our App Store Connect API .p8 to call Apple's REST
 * endpoints (e.g. consumption info, transaction history, refund
 * lookups).
 *
 * The .p8 here is NOT the same key as Sign in with Apple's .p8 —
 * App Store Connect API keys are issued under "Users and Access →
 * Integrations → App Store Connect API" with the "Customer Support"
 * role (or higher) so they can call Send Consumption Information.
 *
 * Required env:
 *   APPLE_APPSTORE_API_KEY_ID       — Key ID of the .p8 (10 chars)
 *   APPLE_APPSTORE_API_PRIVATE_KEY  — PEM contents of the .p8 (multi-
 *                                    line; if env-managed, escape \n
 *                                    with \\n — same convention as
 *                                    APPLE_PRIVATE_KEY)
 *   APPLE_APPSTORE_API_ISSUER_ID    — App Store Connect issuer UUID
 *                                    (Users and Access → Integrations)
 *
 * Optional:
 *   APPLE_APPSTORE_API_BUNDLE_ID    — defaults to APPLE_CLIENT_ID or
 *                                    'com.jiny.lingoloop'
 *
 * When any required env is missing the service logs once on boot and
 * every call returns `false` / no-ops — same pattern as
 * GooglePlayBillingService — so misconfiguration in dev never blocks
 * the rest of the subscription pipeline.
 */

/** Apple's `ConsumptionRequest` body — bucket enums per Apple docs. */
export interface ConsumptionRequestBody {
  /** Must be true; required by Apple. */
  customerConsented: boolean;
  /** 0 undeclared / 1 not / 2 partially / 3 fully consumed. */
  consumptionStatus: 0 | 1 | 2 | 3;
  /** 0 undeclared / 1 apple / 2 non-apple. */
  platform: 0 | 1 | 2;
  sampleContentProvided: boolean;
  /** 0 delivered / 1 quality issue / 2 wrong item / 3 server / 4 connectivity / 5 other. */
  deliveryStatus: 0 | 1 | 2 | 3 | 4 | 5;
  /** Zero UUID when we haven't issued one. */
  appAccountToken: string;
  /** 0 undeclared / 1 <3d / 2 3-10d / 3 10-30d / 4 30-90d / 5 90-180d / 6 180-365d / 7 >365d. */
  accountTenure: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** 0 undeclared / 1 <5min / 2 5-60min / 3 1-6h / 4 6-24h / 5 24h+ (lifetime within app). */
  playTime: 0 | 1 | 2 | 3 | 4 | 5;
  /** Same 0-7 dollar buckets as lifetimeDollarsPurchased. */
  lifetimeDollarsRefunded: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** 0 undeclared / 1 $0 / 2 .01-49.99 / 3 50-99.99 / 4 100-499.99 / 5 500-999.99 / 6 1000-1999.99 / 7 2000+. */
  lifetimeDollarsPurchased: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** 0 undeclared / 1 active / 2 suspended / 3 terminated / 4 limited. */
  userStatus: 0 | 1 | 2 | 3 | 4;
  /** 0 undeclared / 1 prefer grant / 2 prefer decline / 3 no preference. */
  refundPreference: 0 | 1 | 2 | 3;
}

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const PROD_BASE_URL = 'https://api.storekit.itunes.apple.com';
const SANDBOX_BASE_URL = 'https://api.storekit-sandbox.itunes.apple.com';

@Injectable()
export class AppleAppStoreApiService {
  private readonly logger = new Logger(AppleAppStoreApiService.name);
  private readonly keyId?: string;
  private readonly privateKey?: string;
  private readonly issuerId?: string;
  private readonly bundleId: string;

  constructor(config: ConfigService) {
    this.keyId = config.get<string>('APPLE_APPSTORE_API_KEY_ID');
    this.issuerId = config.get<string>('APPLE_APPSTORE_API_ISSUER_ID');
    this.bundleId =
      config.get<string>('APPLE_APPSTORE_API_BUNDLE_ID') ??
      config.get<string>('APPLE_CLIENT_ID', 'com.jiny.lingoloop');

    const rawKey = config.get<string>('APPLE_APPSTORE_API_PRIVATE_KEY');
    if (rawKey) {
      this.privateKey = rawKey.includes('\n')
        ? rawKey
        : rawKey.replace(/\\n/g, '\n');
    }

    if (!this.isConfigured) {
      this.logger.warn(
        'App Store Server API not fully configured — CONSUMPTION_REQUEST and other server-API calls will be skipped. Missing: ' +
          [
            !this.keyId && 'APPLE_APPSTORE_API_KEY_ID',
            !this.privateKey && 'APPLE_APPSTORE_API_PRIVATE_KEY',
            !this.issuerId && 'APPLE_APPSTORE_API_ISSUER_ID',
          ]
            .filter(Boolean)
            .join(', '),
      );
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.keyId && this.privateKey && this.issuerId);
  }

  /**
   * PUT /inApps/v1/transactions/consumption/{originalTransactionId}
   *
   * Apple gives the server 12 hours from CONSUMPTION_REQUEST to respond
   * — after that they decide on the refund without our input, defaulting
   * to grant. Returns true on a 202 (Apple accepted), false on any
   * other outcome (missing config, network error, non-2xx, etc.).
   *
   * Never throws — refund processing must not break because the
   * out-of-band consumption response failed.
   */
  async sendConsumptionInfo(
    originalTransactionId: string,
    body: ConsumptionRequestBody,
    environment: 'production' | 'sandbox',
  ): Promise<boolean> {
    if (!this.isConfigured) return false;
    if (!body.customerConsented) {
      // Apple rejects the request outright if this is false. Guard so
      // we never silently send a useless payload.
      this.logger.warn(
        `sendConsumptionInfo skipped — customerConsented=false for txn=…${tail(originalTransactionId)}`,
      );
      return false;
    }

    let token: string;
    try {
      token = await this.signJwt();
    } catch (e: any) {
      this.logger.error(`Failed to sign App Store API JWT: ${e.message}`);
      return false;
    }

    const base = environment === 'sandbox' ? SANDBOX_BASE_URL : PROD_BASE_URL;
    const url = `${base}/inApps/v1/transactions/consumption/${encodeURIComponent(originalTransactionId)}`;

    try {
      const resp = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (resp.status === 202) {
        return true;
      }
      // Pull Apple's error envelope for the log — useful for ops to
      // distinguish "wrong env" from "key revoked" etc.
      const text = await resp.text().catch(() => '');
      this.logger.warn(
        `App Store consumption PUT failed status=${resp.status} txn=…${tail(originalTransactionId)} env=${environment} body=${text.slice(0, 200)}`,
      );
      return false;
    } catch (e: any) {
      this.logger.error(
        `App Store consumption PUT threw: ${e.message} txn=…${tail(originalTransactionId)}`,
      );
      return false;
    }
  }

  /**
   * Builds the bearer token App Store Server API expects. Valid for
   * 10 minutes — well under Apple's 1-hour cap. ES256 over the .p8.
   */
  private async signJwt(): Promise<string> {
    const pkcs8 = await importPKCS8(this.privateKey!, 'ES256');
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ bid: this.bundleId })
      .setProtectedHeader({ alg: 'ES256', kid: this.keyId!, typ: 'JWT' })
      .setIssuer(this.issuerId!)
      .setIssuedAt(now)
      .setExpirationTime(now + 600)
      .setAudience('appstoreconnect-v1')
      .sign(pkcs8);
  }

  /**
   * Discrete-bucket helpers. Apple's API uses enum buckets rather than
   * raw numbers so a leak via the API doesn't reveal precise account
   * activity. Centralising the mapping lets the caller pass real
   * counts and not worry about the spec drifting.
   */

  static accountTenureBucket(
    days: number,
  ): ConsumptionRequestBody['accountTenure'] {
    if (days < 3) return 1;
    if (days < 10) return 2;
    if (days < 30) return 3;
    if (days < 90) return 4;
    if (days < 180) return 5;
    if (days < 365) return 6;
    return 7;
  }

  static playTimeBucket(minutes: number): ConsumptionRequestBody['playTime'] {
    if (minutes < 5) return 1;
    if (minutes < 60) return 2;
    if (minutes < 6 * 60) return 3;
    if (minutes < 24 * 60) return 4;
    return 5;
  }

  static dollarsBucket(
    usd: number,
  ): ConsumptionRequestBody['lifetimeDollarsPurchased'] {
    if (usd <= 0) return 1;
    if (usd < 50) return 2;
    if (usd < 100) return 3;
    if (usd < 500) return 4;
    if (usd < 1000) return 5;
    if (usd < 2000) return 6;
    return 7;
  }

  static zeroAppAccountToken(): string {
    return ZERO_UUID;
  }
}

function tail(id: string | null | undefined): string {
  if (!id) return '<empty>';
  return id.length <= 8 ? id : id.slice(-8);
}
