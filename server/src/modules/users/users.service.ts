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
    // 운영자 권한 플래그 — backstage에서 토글 가능. true인 user의
    // device token에 신규 문의/결제/환불/취소 이벤트 푸시 발송.
    await this.usersRepo.query(
      `ALTER TABLE ll_users
       ADD COLUMN IF NOT EXISTS "isAdmin" boolean NOT NULL DEFAULT false`,
    );
    // 인증 시점에 클라이언트가 보내는 환경 정보. backstage 유저 상세에
    // "최근 접속/OS/앱 버전/디바이스" 행으로 노출.
    await this.usersRepo.query(
      `ALTER TABLE ll_users ADD COLUMN IF NOT EXISTS "lastSeenAt" timestamp NULL`,
    );
    await this.usersRepo.query(
      `ALTER TABLE ll_users ADD COLUMN IF NOT EXISTS "lastPlatform" varchar NULL`,
    );
    await this.usersRepo.query(
      `ALTER TABLE ll_users ADD COLUMN IF NOT EXISTS "lastOsVersion" varchar NULL`,
    );
    await this.usersRepo.query(
      `ALTER TABLE ll_users ADD COLUMN IF NOT EXISTS "lastAppVersion" varchar NULL`,
    );
    await this.usersRepo.query(
      `ALTER TABLE ll_users ADD COLUMN IF NOT EXISTS "lastAppBuild" varchar NULL`,
    );
    await this.usersRepo.query(
      `ALTER TABLE ll_users ADD COLUMN IF NOT EXISTS "lastDeviceModel" varchar NULL`,
    );

    // ── 다언어 (1.2 phase 1) ────────────────────────────────────────────
    // 언어 row 보장 (idempotent). SentencesService가 같은 INSERT를 부팅
    // 시 실행하지만 NestJS 모듈 init 순서가 비결정적이라 UsersService가
    // 먼저 도는 경우 아래 backfill 조인이 빈 결과를 받게 됨. 같은 INSERT
    // 를 중복 호출해 순서 무관하게 동작.
    await this.usersRepo.query(
      `INSERT INTO ll_languages (code, name, "nativeName")
       VALUES ('en', 'English', '영어'),
              ('ja', 'Japanese', '일본어')
       ON CONFLICT (code) DO NOTHING`,
    );
    // (user_id, language_id) → track 매핑. 사용자가 EN ↔ JA를 전환해도
    // 각 언어의 트랙 선택을 보존. user.learningTrack은 "현재 target lang
    // 의 트랙" snapshot — 권위는 이 표.
    await this.usersRepo.query(
      `CREATE TABLE IF NOT EXISTS ll_user_language_tracks (
         id SERIAL PRIMARY KEY,
         user_id uuid NOT NULL REFERENCES ll_users(id) ON DELETE CASCADE,
         language_id int NOT NULL REFERENCES ll_languages(id) ON DELETE CASCADE,
         track varchar NOT NULL,
         "createdAt" timestamp NOT NULL DEFAULT now(),
         "updatedAt" timestamp NOT NULL DEFAULT now()
       )`,
    );
    await this.usersRepo.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_ll_user_lang_tracks_user_lang
       ON ll_user_language_tracks (user_id, language_id)`,
    );
    // Backfill: 기존 사용자가 가진 user.learningTrack을 현재
    // user.targetLanguage 기준 row로 옮김. 멱등 — ON CONFLICT skip.
    await this.usersRepo.query(
      `INSERT INTO ll_user_language_tracks (user_id, language_id, track)
       SELECT u.id, l.id, u."learningTrack"
       FROM ll_users u
       JOIN ll_languages l ON l.code = u."targetLanguage"
       WHERE u."learningTrack" IS NOT NULL
       ON CONFLICT (user_id, language_id) DO NOTHING`,
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
