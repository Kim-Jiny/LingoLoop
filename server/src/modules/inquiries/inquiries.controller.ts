import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../users/user.entity.js';
import { CreateInquiryDto } from './dto/create-inquiry.dto.js';
import { InquiriesService } from './inquiries.service.js';

@Controller('api/inquiries')
export class InquiriesController {
  constructor(private inquiriesService: InquiriesService) {}

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateInquiryDto,
    @Req() req: Request,
  ) {
    return this.inquiriesService.create(user, dto, {
      ipAddress: clientIp(req),
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  /** 본인 문의 + 답변 리스트. unread 배지 계산에도 사용. */
  @Get()
  listMine(@CurrentUser() user: User) {
    return this.inquiriesService.listForUser(user.id);
  }

  /** 답변 확인 처리. unread → read 전환. */
  @Post(':id/read')
  markRead(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.inquiriesService.markRead(user.id, id);
  }
}

function clientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0]?.split(',')[0]?.trim() || null;
  if (forwarded) return forwarded.split(',')[0]?.trim() || null;
  return req.ip || req.socket.remoteAddress || null;
}
