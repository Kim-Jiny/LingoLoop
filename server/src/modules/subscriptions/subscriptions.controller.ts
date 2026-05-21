import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { User } from '../users/user.entity.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { VerifyPurchaseDto } from './dto/verify-purchase.dto.js';

@Controller('api/subscriptions')
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(private subscriptionsService: SubscriptionsService) {}

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
   * payload IS the authentication. Errors logged + 200 returned so
   * Apple stops retrying a permanently bad message.
   */
  @Public()
  @Post('webhook/apple')
  @HttpCode(200)
  async appleWebhook(@Body() body: { signedPayload: string }) {
    try {
      if (!body?.signedPayload) return { ok: false, reason: 'no payload' };
      await this.subscriptionsService.applyAppleNotification(body.signedPayload);
      return { ok: true };
    } catch (e: any) {
      this.logger.warn(`Apple webhook failed: ${e.message}`);
      return { ok: false };
    }
  }

  /**
   * Google Play Real-time Developer Notifications via Pub/Sub push.
   * Body envelope: { message: { data: base64, attributes }, subscription }.
   */
  @Public()
  @Post('webhook/google')
  @HttpCode(200)
  async googleWebhook(@Body() body: any) {
    try {
      await this.subscriptionsService.applyGoogleNotification(body);
      return { ok: true };
    } catch (e: any) {
      this.logger.warn(`Google webhook failed: ${e.message}`);
      return { ok: false };
    }
  }
}
