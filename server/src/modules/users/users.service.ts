import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
   * Permanently deletes the user and all of their data.
   *
   * Most child tables CASCADE on `user_id` so the single DELETE on
   * `ll_users` removes them transitively (auth_identity, refresh_token,
   * device_token, push_log, notification_settings, subscription,
   * vocabulary, quiz_attempt). Two tables — ll_daily_assignments and
   * ll_learning_progress — declare bare @ManyToOne with no onDelete,
   * which Postgres treats as NO ACTION and would otherwise block the
   * user delete. We sweep them first inside a transaction so the whole
   * operation is atomic.
   *
   * App Store and Play Store both require in-app account deletion when
   * the app supports account creation.
   */
  async deleteAccount(id: string): Promise<void> {
    await this.usersRepo.manager.transaction(async (tx) => {
      await tx.query(
        'DELETE FROM ll_learning_progress WHERE user_id = $1',
        [id],
      );
      await tx.query(
        'DELETE FROM ll_daily_assignments WHERE user_id = $1',
        [id],
      );
      await tx.query('DELETE FROM ll_users WHERE id = $1', [id]);
    });
  }
}
