import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

/**
 * Verifies the OIDC bearer token that Google Pub/Sub attaches to push
 * subscriptions. Without this, our webhook accepts JSON bodies from
 * anyone — the body fingerprint (productId/purchaseToken) is checked
 * against the Play Developer API which catches forged tokens, but a
 * malicious caller can still trigger an API roundtrip per request and
 * spam logs.
 *
 * Setup (Phase 4):
 *   1. In the Pub/Sub push subscription → Authentication → enable.
 *      Pick a service account (you can reuse the Play Billing one).
 *      Set the audience to a fixed string (URL of the webhook is the
 *      Google-recommended default).
 *   2. Set GOOGLE_PUBSUB_AUDIENCE to the same string here.
 *   3. Set GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL to the service account
 *      email Pub/Sub uses to sign tokens.
 *
 * When `GOOGLE_PUBSUB_AUDIENCE` is unset, verification is skipped and
 * we log a warning once at boot so it's obvious the protection isn't
 * wired up yet.
 */
@Injectable()
export class PubSubVerifierService {
  private readonly logger = new Logger(PubSubVerifierService.name);
  private readonly audience: string | undefined;
  private readonly serviceAccountEmail: string | undefined;
  private readonly client = new OAuth2Client();
  private warnedOnce = false;

  constructor(config: ConfigService) {
    this.audience = config.get<string>('GOOGLE_PUBSUB_AUDIENCE') || undefined;
    this.serviceAccountEmail =
      config.get<string>('GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL') || undefined;

    if (!this.audience) {
      // 1.1.0 출시 시점 — IAP가 실제로 활성화돼 Pub/Sub이 voided/
      // expired notification을 push하기 시작함. audience 미설정 시
      // 누구나 webhook URL에 voidedPurchaseNotification 본문을
      // 위조 POST → 다른 사용자 구독을 revoke 가능 (remote
      // subscription-revocation oracle). 부팅 시점에 hard-fail로
      // 잘못된 배포를 즉시 감지.
      const isProd =
        (config.get<string>('NODE_ENV') ?? 'development') === 'production';
      if (isProd) {
        throw new InternalServerErrorException(
          'GOOGLE_PUBSUB_AUDIENCE must be set in production — refusing to start ' +
            'with an unauthenticated Pub/Sub webhook (forged void-purchase oracle risk).',
        );
      }
      this.logger.warn(
        'GOOGLE_PUBSUB_AUDIENCE not set — Pub/Sub push tokens will NOT be verified (dev).',
      );
    }
  }

  /**
   * Throws on bad/missing token when audience is configured. No-ops
   * silently when audience is unset (dev / setup mode).
   */
  async verify(authorizationHeader: string | undefined): Promise<void> {
    if (!this.audience) {
      if (!this.warnedOnce) {
        this.logger.warn('Skipping Pub/Sub token verification (no audience set)');
        this.warnedOnce = true;
      }
      return;
    }

    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new Error('Missing Pub/Sub OIDC bearer token');
    }
    const token = authorizationHeader.slice('Bearer '.length).trim();

    const ticket = await this.client.verifyIdToken({
      idToken: token,
      audience: this.audience,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Pub/Sub OIDC token has no payload');
    }
    if (payload.iss !== 'https://accounts.google.com' &&
        payload.iss !== 'accounts.google.com') {
      throw new Error(`Pub/Sub OIDC token issuer ${payload.iss} not Google`);
    }
    if (
      this.serviceAccountEmail &&
      payload.email !== this.serviceAccountEmail
    ) {
      throw new Error(
        `Pub/Sub OIDC token email ${payload.email} != configured service account`,
      );
    }
    // Only reject when Google EXPLICITLY says email_verified=false.
    // If the claim is absent (older token format, Google rolling out
    // a change), we already validated audience + email + issuer so
    // the token is still authentic.
    if (this.serviceAccountEmail && payload.email_verified === false) {
      throw new Error('Pub/Sub OIDC token email not verified');
    }
  }
}
