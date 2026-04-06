import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './subscription.entity.js';
import { User } from '../users/user.entity.js';
import { VerifyPurchaseDto } from './dto/verify-purchase.dto.js';
import { AppConfig } from '../admin/app-config.entity.js';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(AppConfig)
    private appConfigRepo: Repository<AppConfig>,
  ) {}

  async getCurrentSubscription(userId: string) {
    const user = await this.usersRepo.findOneByOrFail({ id: userId });
    const subscription = await this.ensureSubscription(user);

    return this.serialize(subscription, user);
  }

  private async ensureSubscription(user: User) {
    let subscription = await this.subscriptionRepo.findOne({
      where: { userId: user.id },
    });

    if (!subscription) {
      subscription = this.subscriptionRepo.create({
        userId: user.id,
        plan: user.subscriptionTier,
        store: 'mock',
        isActive: user.subscriptionTier === 'premium',
      });
      subscription = await this.subscriptionRepo.save(subscription);
    }

    return subscription;
  }

  async verifyPurchase(userId: string, dto: VerifyPurchaseDto) {
    const user = await this.usersRepo.findOneByOrFail({ id: userId });
    const subscription = await this.ensureSubscription(user);
    const knownProduct = await this.appConfigRepo.findOne({
      where: { premiumMonthlyProductId: dto.productId },
    });

    if (!knownProduct) {
      return this.serialize(subscription, user);
    }

    if (!dto.purchaseId && !dto.serverVerificationData) {
      return this.serialize(subscription, user);
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    subscription.plan = 'premium';
    subscription.store = dto.source;
    subscription.storeTransactionId =
      dto.purchaseId || dto.serverVerificationData.slice(0, 120);
    subscription.expiresAt = expiresAt;
    subscription.isActive = true;

    user.subscriptionTier = 'premium';

    await this.usersRepo.save(user);
    const saved = await this.subscriptionRepo.save(subscription);
    return this.serialize(saved, user);
  }

  private serialize(subscription: Subscription, user: User) {
    return {
      plan: subscription.plan,
      isActive: subscription.isActive,
      expiresAt: subscription.expiresAt,
      store: subscription.store,
      subscriptionTier: user.subscriptionTier,
      displayPriceKrw: 3000,
      billingMode: 'mock',
    };
  }
}
