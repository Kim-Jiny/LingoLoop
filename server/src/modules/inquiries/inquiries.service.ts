import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Inquiry } from './inquiry.entity.js';
import { CreateInquiryDto } from './dto/create-inquiry.dto.js';
import { User } from '../users/user.entity.js';
import { DeviceToken } from '../notifications/device-token.entity.js';
import { FcmService } from '../notifications/fcm.service.js';

@Injectable()
export class InquiriesService implements OnModuleInit {
  private readonly logger = new Logger(InquiriesService.name);

  constructor(
    @InjectRepository(Inquiry)
    private inquiryRepo: Repository<Inquiry>,
    @InjectRepository(DeviceToken)
    private deviceTokenRepo: Repository<DeviceToken>,
    private fcm: FcmService,
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
    // 2026-05: reply fields. text nullable for not-yet-answered rows.
    await this.inquiryRepo.query(
      `ALTER TABLE ll_inquiries ADD COLUMN IF NOT EXISTS reply text NULL`,
    );
    await this.inquiryRepo.query(
      `ALTER TABLE ll_inquiries ADD COLUMN IF NOT EXISTS replied_at timestamptz NULL`,
    );
    await this.inquiryRepo.query(
      `ALTER TABLE ll_inquiries ADD COLUMN IF NOT EXISTS replied_by varchar NULL`,
    );
    await this.inquiryRepo.query(
      `ALTER TABLE ll_inquiries ADD COLUMN IF NOT EXISTS user_read_at timestamptz NULL`,
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

  /**
   * 사용자의 본인 문의 리스트. 최신순. unread(repliedAt != null AND
   * userReadAt == null)도 같이 계산해 응답.
   */
  async listForUser(userId: string) {
    const rows = await this.inquiryRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' as const },
      take: 50,
    });
    return {
      items: rows.map((r) => this.serializeForUser(r)),
      unreadCount: rows.filter(
        (r) => r.repliedAt && !r.userReadAt,
      ).length,
    };
  }

  /** 사용자가 답변을 확인했음을 표시. */
  async markRead(userId: string, inquiryId: number) {
    const inquiry = await this.inquiryRepo.findOne({
      where: { id: inquiryId, userId },
    });
    if (!inquiry) {
      throw new NotFoundException('문의를 찾을 수 없어요.');
    }
    if (!inquiry.userReadAt) {
      await this.inquiryRepo.update(
        { id: inquiryId },
        { userReadAt: new Date() },
      );
    }
    return { ok: true };
  }

  /**
   * 관리자가 답변 작성. status를 'answered'로 옮기고, 같은 사용자에게
   * 푸시 1회 발송. 푸시 실패는 답변 저장을 막지 않음 — 사용자는
   * 어쨌든 앱에서 답변을 볼 수 있어야 하니까.
   */
  async addReply(
    inquiryId: number,
    reply: string,
    adminUsername: string,
  ) {
    const trimmed = reply.trim();
    if (!trimmed) {
      throw new NotFoundException('답변 내용이 비어있어요.');
    }
    const inquiry = await this.inquiryRepo.findOne({
      where: { id: inquiryId },
    });
    if (!inquiry) {
      throw new NotFoundException('문의를 찾을 수 없어요.');
    }

    await this.inquiryRepo.update(
      { id: inquiryId },
      {
        reply: trimmed,
        repliedAt: new Date(),
        repliedBy: adminUsername,
        status: 'answered',
        // 새 답변이 달리면 unread 상태로 리셋 — 사용자가 다시 확인
        // 해야 함.
        userReadAt: null,
      },
    );

    if (inquiry.userId) {
      await this.pushReplyNotification(inquiry.userId, inquiryId, trimmed);
    }

    return { ok: true };
  }

  /**
   * 사용자의 활성 디바이스 모두에 푸시. 토큰 없으면 silent skip
   * (사용자가 앱 알림 꺼놓은 경우 등). data payload는 클라이언트가
   * 탭 시 라우팅하기 위한 정보.
   */
  private async pushReplyNotification(
    userId: string,
    inquiryId: number,
    snippet: string,
  ): Promise<void> {
    const tokens = await this.deviceTokenRepo.find({
      where: { userId, isActive: true },
    });
    if (tokens.length === 0) return;

    // 답변 미리보기는 60자로 자름 — 푸시 본문은 OS가 어차피 자르고,
    // 너무 길면 잠금화면에 어수선해 보임.
    const preview =
      snippet.length > 60 ? snippet.slice(0, 60).trimEnd() + '…' : snippet;

    for (const t of tokens) {
      const ok = await this.fcm.sendToDevice(t.token, {
        title: '문의 답변이 도착했어요',
        body: preview,
        data: {
          type: 'inquiry_reply',
          inquiryId: String(inquiryId),
        },
        // Android NotificationManager tag — 클라가 in-app 처리 후
        // 이 tag만 골라 cancel해서 시스템 트레이 정리. iOS는 영향
        // 없음(같은 tag으로 보낸 답변끼리 자동 collapse되는 부수
        // 효과는 의도된 결과 — 답변 여러 개 와도 트레이 하나만 유지).
        androidTag: 'inquiry_reply',
      });
      if (!ok) {
        // FCM이 토큰 무효라고 응답한 경우만 false 반환. 정리.
        await this.deviceTokenRepo.update(
          { id: t.id },
          { isActive: false },
        );
      }
    }
  }

  private serializeForUser(r: Inquiry) {
    return {
      id: r.id,
      category: r.category,
      message: r.message,
      status: r.status,
      createdAt: r.createdAt,
      reply: r.reply,
      repliedAt: r.repliedAt,
      isUnreadReply: !!r.repliedAt && !r.userReadAt,
    };
  }
}
