import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inquiry } from './inquiry.entity.js';
import { CreateInquiryDto } from './dto/create-inquiry.dto.js';
import { User } from '../users/user.entity.js';

@Injectable()
export class InquiriesService implements OnModuleInit {
  constructor(
    @InjectRepository(Inquiry)
    private inquiryRepo: Repository<Inquiry>,
  ) {}

  async onModuleInit() {
    await this.inquiryRepo.query(`
      CREATE TABLE IF NOT EXISTS ll_inquiries (
        id serial PRIMARY KEY,
        user_id uuid NULL REFERENCES ll_users(id) ON DELETE SET NULL,
        category varchar NOT NULL DEFAULT 'general',
        email varchar NULL,
        message text NOT NULL,
        ip_address varchar NULL,
        user_agent text NULL,
        status varchar NOT NULL DEFAULT 'open',
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await this.inquiryRepo.query(
      `ALTER TABLE ll_inquiries ADD COLUMN IF NOT EXISTS ip_address varchar NULL`,
    );
    await this.inquiryRepo.query(
      `ALTER TABLE ll_inquiries ADD COLUMN IF NOT EXISTS user_agent text NULL`,
    );
    await this.inquiryRepo.query(
      `CREATE INDEX IF NOT EXISTS ll_inquiries_created_idx
       ON ll_inquiries (created_at DESC)`,
    );
    await this.inquiryRepo.query(
      `CREATE INDEX IF NOT EXISTS ll_inquiries_user_idx
       ON ll_inquiries (user_id)`,
    );
  }

  async create(
    user: User,
    dto: CreateInquiryDto,
    requestMeta?: { ipAddress?: string | null; userAgent?: string | string[] | null },
  ) {
    const inquiry = this.inquiryRepo.create({
      userId: user.id,
      category: dto.category ?? 'general',
      email: dto.email?.trim() || user.email || null,
      message: dto.message.trim(),
      ipAddress: requestMeta?.ipAddress ?? null,
      userAgent: Array.isArray(requestMeta?.userAgent)
        ? requestMeta.userAgent.join(', ')
        : requestMeta?.userAgent ?? null,
      status: 'open',
    });
    const saved = await this.inquiryRepo.save(inquiry);
    return { id: saved.id, createdAt: saved.createdAt };
  }
}
