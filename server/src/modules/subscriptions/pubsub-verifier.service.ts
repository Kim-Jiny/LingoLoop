import { Injectable, Logger } from '@nestjs/common';
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
      const isProd =
        (config.get<string>('NODE_ENV') ?? 'development') === 'production';
      if (isProd) {
        // Hard-fail at boot. Without audience verification, any
        // unauthenticated POST to /webhook/google with a forged
        // voidedPurchaseNotification can revoke any user's
        // subscription (revokeByPurchaseToken looks up by token but
        // doesn't re-verify against Google). This MUST be set in
        // production.
        throw new Error(
          'GOOGLE_PUBSUB_AUDIENCE is required in production — the Google webhook would otherwise accept forged void notifications. Set it to the webhook URL configured in the Pub/Sub push subscription.',
        );
      }
      this.logger.warn(
        'GOOGLE_PUBSUB_AUDIENCE not set — Pub/Sub push tokens will NOT be verified. OK for dev, but the production server refuses to boot without it.',
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
