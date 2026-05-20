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
    // Apple refresh-token cache so we can revoke at account deletion.
    await this.usersRepo.query(
      `ALTER TABLE ll_auth_identities
       ADD COLUMN IF NOT EXISTS apple_refresh_token text NULL`,
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
             "deletedAt" = NOW()
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
    });
  }
}
