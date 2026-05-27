import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { User } from './user.entity.js';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  /** synchronize is off in prod; add the new column idempotently. */
  async onModuleInit() {
    await this.usersRepo.query(
      `ALTER TABLE ll_users
       ADD COLUMN IF NOT EXISTS timezone varchar NOT NULL DEFAULT 'Asia/Seoul'`,
    );
    await this.usersRepo.query(
      `ALTER TABLE ll_users ADD COLUMN IF NOT EXISTS "learningTrack" varchar`,
    );
    await this.usersRepo.query(
      `ALTER TABLE ll_users
       ADD COLUMN IF NOT EXISTS "dailyGoal" int NOT NULL DEFAULT 3`,
    );
    // Soft-delete timestamp. Account-deletion mangles email + providerId
    // to free unique constraints, marks isActive=false, and stamps this.
    await this.usersRepo.query(
      `ALTER TABLE ll_users
       ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL`,
    );
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.usersRepo.create(data);
    return this.usersRepo.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.usersRepo.update(id, data);
    return this.findById(id) as Promise<User>;
  }

  /**
   * Soft-deletes the user. We keep all historical data (learning
   * progress, daily assignments, push logs, etc.) for analytics + audit
   * but anonymise the identifiers so the same email / social account
   * can register fresh:
   *
   *  - `ll_users.email`                  → "del_<rand5>_<original>"
   *  - `ll_users.isActive`               → false (JwtStrategy rejects)
   *  - `ll_users.deletedAt`              → NOW()
   *  - `ll_auth_identities.provider_id`  → "del_<rand5>_<original>"
   *  - `ll_auth_identities.email`        → "del_<rand5>_<original>"
   *  - `ll_refresh_tokens.isRevoked`     → true
   *  - `ll_device_tokens.isActive`       → false (stops push delivery)
   *
   * All inside a single transaction so the user either stays consistent
   * or doesn't change at all. Required for App Store / Play Store
   * account-deletion compliance.
   */
  async deleteAccount(id: string): Promise<void> {
    const suffix = `del_${randomBytes(8).toString('hex').slice(0, 5)}_`;
    await this.usersRepo.manager.transaction(async (tx) => {
      await tx.query(
        `UPDATE ll_users
         SET email = $1 || email,
             "isActive" = false,
             "deletedAt" = NOW(),
             "subscriptionTier" = 'free'
         WHERE id = $2`,
        [suffix, id],
      );
      await tx.query(
        `UPDATE ll_auth_identities
         SET provider_id = $1 || provider_id,
             email = CASE WHEN email IS NOT NULL
                          THEN $1 || email
                          ELSE email END
         WHERE user_id = $2`,
        [suffix, id],
      );
      await tx.query(
        `UPDATE ll_refresh_tokens SET "isRevoked" = true WHERE user_id = $1`,
        [id],
      );
      await tx.query(
        `UPDATE ll_device_tokens SET "isActive" = false WHERE user_id = $1`,
        [id],
      );
      // Revoke the subscription row alongside the user. Without this,
      // admin "active premium" metrics include departed users forever
      // (deletedAt filters them out at the users table, but anyone
      // counting `subscriptionTier='premium'` without joining deletedAt
      // would over-report). Also: webhook handlers skip deleted users
      // entirely, so the row would otherwise freeze in time at the
      // moment of deletion — better to mark it free + revoked now
      // than to leave a misleading "active premium" row in the DB.
      //
      // RETURNING captures the affected subscription so we can write
      // the matching audit-log entry in the same transaction. Without
      // an event row, support investigating "premium then deleted"
      // cases would see the subscription drop out of admin views with
      // no trace of why.
      const revoked: Array<{
        id: number;
        original_transaction_id: string | null;
        product_id: string | null;
      }> = await tx.query(
        `UPDATE ll_subscriptions
         SET "isActive" = false,
             "plan" = 'free',
             "auto_renew" = false,
             "revoked_at" = COALESCE(revoked_at, NOW())
         WHERE user_id = $1 AND "isActive" = true
         RETURNING id, original_transaction_id, product_id`,
        [id],
      );
      for (const row of revoked) {
        await tx.query(
          `INSERT INTO ll_subscription_events
             (user_id, subscription_id, source, event_type,
              original_transaction_id, product_id, outcome)
           VALUES ($1, $2, 'user_deleted', 'account_deleted', $3, $4, 'applied')`,
          [id, row.id, row.original_transaction_id, row.product_id],
        );
      }
    });
  }
}
