import { Body, Controller, Post, Req } from '@nestjs/common';
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
}

function clientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0]?.split(',')[0]?.trim() || null;
  if (forwarded) return forwarded.split(',')[0]?.trim() || null;
  return req.ip || req.socket.remoteAddress || null;
}
