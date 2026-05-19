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
}
