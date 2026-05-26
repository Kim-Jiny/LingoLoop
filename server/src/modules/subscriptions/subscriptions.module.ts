import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './subscription.entity.js';
import { SubscriptionEvent } from './subscription-event.entity.js';
import { User } from '../users/user.entity.js';
import { SubscriptionsController } from './subscriptions.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { AppConfig } from '../admin/app-config.entity.js';
import { AppleStorekitService } from './apple-storekit.service.js';
import { AppleAppStoreApiService } from './apple-appstore-api.service.js';
import { GooglePlayBillingService } from './google-play-billing.service.js';
import { PubSubVerifierService } from './pubsub-verifier.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, SubscriptionEvent, User, AppConfig]),
    NotificationsModule,
  ],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    AppleStorekitService,
    AppleAppStoreApiService,
    GooglePlayBillingService,
    PubSubVerifierService,
  ],
  exports: [
    SubscriptionsService,
    AppleStorekitService,
    AppleAppStoreApiService,
    GooglePlayBillingService,
  ],
})
export class SubscriptionsModule {}
