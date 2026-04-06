import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../users/user.entity.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { VerifyPurchaseDto } from './dto/verify-purchase.dto.js';

@Controller('api/subscriptions')
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get('me')
  getCurrent(@CurrentUser() user: User) {
    return this.subscriptionsService.getCurrentSubscription(user.id);
  }

  @Post('verify')
  verify(@CurrentUser() user: User, @Body() dto: VerifyPurchaseDto) {
    return this.subscriptionsService.verifyPurchase(user.id, dto);
  }
}
