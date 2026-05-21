import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { User } from '../users/user.entity.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { PubSubVerifierService } from './pubsub-verifier.service.js';
import { VerifyPurchaseDto } from './dto/verify-purchase.dto.js';

@Controller('api/subscriptions')
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(
    private subscriptionsService: SubscriptionsService,
    private pubsubVerifier: PubSubVerifierService,
  ) {}

  @Get('me')
  getCurrent(@CurrentUser() user: User) {
    return this.subscriptionsService.getCurrentSubscription(user.id);
  }

  @Post('verify')
  verify(@CurrentUser() user: User, @Body() dto: VerifyPurchaseDto) {
    return this.subscriptionsService.verifyPurchase(user.id, dto);
  }

  /**
   * App Store Server Notifications V2. Called by Apple, not the app.
   * @Public bypasses the JWT guard; the JWS signature inside the
   * payload IS the authentication.
   *
   * Error contract: a permanently bad payload (bad signature, wrong
   * bundle id, garbage JSON) returns 200 so Apple stops retrying.
   * Anything else (DB down, transient I/O) rethrows so NestJS
   * answers 5xx and Apple retries with backoff for up to 3 days.
   */
  @Public()
  @Post('webhook/apple')
  @HttpCode(200)
  async appleWebhook(@Body() body: { signedPayload: string }) {
    if (!body?.signedPayload) return { ok: false, reason: 'no payload' };
    try {
      await this.subscriptionsService.applyAppleNotification(body.signedPayload);
      return { ok: true };
    } catch (e: any) {
      if (isPermanentWebhookFailure(e)) {
        this.logger.warn(`Apple webhook permanent failure: ${e.message}`);
        return { ok: false, reason: 'permanent' };
      }
      this.logger.error(`Apple webhook transient failure: ${e.message}`);
      throw e; // → 5xx → Apple retries
    }
  }

  /**
   * Google Play Real-time Developer Notifications via Pub/Sub push.
   * Body envelope: { message: { data: base64, attributes }, subscription }.
   *
   * Same error contract as Apple — Pub/Sub retries on 5xx for up to
   * 7 days by default.
   */
  @Public()
  @Post('webhook/google')
  @HttpCode(200)
  async googleWebhook(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
  ) {
    try {
      // OIDC token verification — confirms this body really came from
      // the configured Pub/Sub subscription. No-op when audience env
      // is unset (dev mode).
      await this.pubsubVerifier.verify(authorization);
      await this.subscriptionsService.applyGoogleNotification(body);
      return { ok: true };
    } catch (e: any) {
      if (isPermanentWebhookFailure(e)) {
        this.logger.warn(`Google webhook permanent failure: ${e.message}`);
        return { ok: false, reason: 'permanent' };
      }
      this.logger.error(`Google webhook transient failure: ${e.message}`);
      throw e;
    }
  }
}

/**
 * Classifies webhook errors. Permanent → 200 + drop. Transient → 5xx
 * + provider retries. When in doubt we treat it as transient so a
 * retryable bug doesn't silently eat real renewals.
 */
function isPermanentWebhookFailure(e: any): boolean {
  const m: string = e?.message ?? '';
  return (
    m.startsWith('JWS missing') ||
    m.startsWith('Cert chain broken') ||
    m.startsWith('Chain does not anchor') ||
    m.startsWith('Cert at index') ||
    m.startsWith('Unexpected JWS alg') ||
    m.startsWith('Notification bundle id mismatch') ||
    m.startsWith('Bundle id mismatch') ||
    m.startsWith('Missing Pub/Sub OIDC') ||
    m.startsWith('Pub/Sub OIDC') ||
    e instanceof SyntaxError // bad JSON envelope
  );
}
