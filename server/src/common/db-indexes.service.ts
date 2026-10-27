import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Non-unique lookup indexes for hot paths. Production runs with
 * `synchronize` off, so entity changes need raw SQL; this follows the
 * existing `CREATE INDEX IF NOT EXISTS` pattern used by the services.
 *
 * Safety:
 *  - CONCURRENTLY: builds without blocking writes (can't run in a txn,
 *    which is fine — `DataSource.query` uses a plain pooled connection).
 *  - Each statement is isolated and non-fatal: a failure (missing table,
 *    wrong column) only logs and never stops startup.
 *  - Runs in the background after bootstrap so it doesn't delay readiness.
 *  - Non-unique only; unique constraints need a duplicate check first.
 */
const INDEXES: ReadonlyArray<{ name: string; sql: string }> = [
  {
    name: 'll_quiz_attempts_user_idx',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ll_quiz_attempts_user_idx
            ON ll_quiz_attempts (user_id)`,
  },
  {
    name: 'll_refresh_tokens_token_idx',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ll_refresh_tokens_token_idx
            ON ll_refresh_tokens (token)`,
  },
  {
    name: 'll_refresh_tokens_user_idx',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ll_refresh_tokens_user_idx
            ON ll_refresh_tokens (user_id)`,
  },
  {
    name: 'll_device_tokens_token_idx',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ll_device_tokens_token_idx
            ON ll_device_tokens (token)`,
  },
  {
    name: 'll_device_tokens_user_idx',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ll_device_tokens_user_idx
            ON ll_device_tokens (user_id)`,
  },
  {
    name: 'll_push_logs_user_idx',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ll_push_logs_user_idx
            ON ll_push_logs (user_id)`,
  },
  {
    // The push cron filters on this every minute.
    name: 'll_notification_settings_next_push_idx',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ll_notification_settings_next_push_idx
            ON ll_notification_settings ("nextPushAt")`,
  },
  {
    name: 'll_learning_progress_user_sentence_idx',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ll_learning_progress_user_sentence_idx
            ON ll_learning_progress (user_id, sentence_id)`,
  },
  {
    name: 'll_sentences_lang_track_active_idx',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ll_sentences_lang_track_active_idx
            ON ll_sentences (language_id, track, "isActive")`,
  },
];

@Injectable()
export class DbIndexesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DbIndexesService.name);

  constructor(private readonly dataSource: DataSource) {}

  onApplicationBootstrap() {
    // Fire-and-forget: never block or fail startup on index builds.
    void this.ensureIndexes();
  }

  private async ensureIndexes() {
    for (const idx of INDEXES) {
      try {
        await this.dataSource.query(idx.sql);
      } catch (e: any) {
        this.logger.warn(`Index ${idx.name} skipped: ${e?.message ?? e}`);
      }
    }
    this.logger.log('DB index check finished');
  }
}
