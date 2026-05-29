import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminService } from './admin.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { UpdateAppConfigDto } from './dto/update-app-config.dto.js';
import { AdminSessionGuard } from './admin-session.guard.js';

@Controller('api/admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Public()
  @UseGuards(AdminSessionGuard)
  @Post('seed')
  seed() {
    return this.adminService.seed();
  }

  @Public()
  @Get('app-config/public')
  getPublicAppConfig() {
    return this.adminService.getPublicAppConfig();
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Get('app-config')
  getAppConfig() {
    return this.adminService.getAppConfig();
  }

  // Dashboard data feeds the /backstage page. @Public() bypasses the
  // global JWT guard; AdminSessionGuard then enforces the admin cookie.
  @Public()
  @UseGuards(AdminSessionGuard)
  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboardData();
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Put('app-config')
  updateAppConfig(@Body() dto: UpdateAppConfigDto) {
    return this.adminService.updateAppConfig(dto);
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Get('users')
  listUsers(
    @Query('q') q?: string,
    @Query('provider') provider?: string,
    @Query('track') track?: string,
    @Query('plan') plan?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listUsers({
      q,
      provider,
      track,
      plan,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Get('subscriptions/dashboard')
  getSubscriptionDashboard(@Query('env') env?: string) {
    const filter: 'production' | 'sandbox' | 'all' =
      env === 'sandbox' || env === 'all' ? env : 'production';
    return this.adminService.getSubscriptionDashboard(filter);
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Get('subscriptions/verification')
  getVerificationLog(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('outcome') outcome?: string,
    @Query('source') source?: string,
  ) {
    return this.adminService.getVerificationLog(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      outcome,
      source,
    );
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Post('users/:id/grant-premium')
  grantPremium(
    @Param('id') id: string,
    @Body() body: { days: number; reason?: string },
    @Req() req: Request & { adminUsername?: string },
  ) {
    return this.adminService.grantPremium(
      req.adminUsername ?? 'unknown',
      id,
      Number(body?.days),
      body?.reason,
    );
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Post('users/:id/revoke-premium')
  revokePremium(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: Request & { adminUsername?: string },
  ) {
    return this.adminService.revokePremium(
      req.adminUsername ?? 'unknown',
      id,
      body?.reason,
    );
  }

  /** 운영자 권한 부여/해제. backstage user detail의 토글에서 호출. */
  @Public()
  @UseGuards(AdminSessionGuard)
  @Post('users/:id/set-admin')
  setAdminRole(
    @Param('id') id: string,
    @Body() body: { isAdmin: boolean },
    @Req() req: Request & { adminUsername?: string },
  ) {
    return this.adminService.setAdminRole(
      req.adminUsername ?? 'unknown',
      id,
      !!body?.isAdmin,
    );
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Get('sentences/tracks')
  trackCounts() {
    return this.adminService.getTrackCounts();
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Get('sentences')
  listSentences(
    @Query('track') track?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listSentences({
      track,
      q,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Get('sentences/:id')
  getSentence(@Param('id') id: string) {
    return this.adminService.getSentenceForEdit(parseInt(id, 10));
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Post('sentences')
  createSentence(@Body() body: any) {
    return this.adminService.createSentence(body);
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Patch('sentences/:id')
  updateSentence(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateSentence(parseInt(id, 10), body);
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Delete('sentences/:id')
  @HttpCode(204)
  async deleteSentence(@Param('id') id: string, @Query('hard') hard?: string) {
    const n = parseInt(id, 10);
    if (hard === 'true' || hard === '1') {
      await this.adminService.hardDeleteSentence(n);
    } else {
      await this.adminService.deleteSentence(n);
    }
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Post('sentences/bulk')
  bulkSentences(@Body() body: { track: string; rows: any[] }) {
    return this.adminService.bulkCreateSentences(body.track, body.rows);
  }

  // ─────────────────────── 단어 활용형 (word forms) ────────────────────
  @Public()
  @UseGuards(AdminSessionGuard)
  @Get('word-forms')
  listWordFormCoverage(
    @Query('q') q?: string,
    @Query('coverage') coverage?: 'all' | 'missing' | 'filled',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listWordFormCoverage({
      q,
      coverage,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Get('word-forms/batch')
  getWordFormBatch(@Query('limit') limit?: string) {
    return this.adminService.getWordFormBatch(
      limit ? parseInt(limit, 10) : 100,
    );
  }

  /**
   * 단어 활용형 사전 1건 상세 — backstage 단어 페이지에서 "상세" 클릭
   * 시 모달로 forms/examples 통째로 표시.
   *
   * 키는 baseWord + languageCode. id로 받지 않은 이유: 클라(backstage
   * 목록)가 wordFormId 없이도 baseWord만으로 detail을 열 수 있게 —
   * forms 미생성 단어 행에서 "AI로 채운 뒤 즉시 보기" 흐름까지 동일
   * URL로 처리.
   */
  @Public()
  @UseGuards(AdminSessionGuard)
  @Get('word-forms/detail')
  getWordFormDetail(
    @Query('baseWord') baseWord: string,
    @Query('lang') lang?: string,
  ) {
    return this.adminService.getWordFormDetail(baseWord, lang ?? 'en');
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Post('word-forms/bulk')
  bulkUpsertWordForms(@Body() body: { rows: any[]; source?: string }) {
    return this.adminService.bulkUpsertWordForms(
      body?.rows ?? [],
      body?.source,
    );
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Get('pushes')
  listPushes(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listPushes({
      type,
      status,
      userId,
      q,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Get('inquiries')
  listInquiries(
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listInquiries({
      category,
      status,
      q,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Post('inquiries/:id/reply')
  replyToInquiry(
    @Param('id') id: string,
    @Body() body: { reply: string },
    @Req() req: Request & { adminUsername?: string },
  ) {
    return this.adminService.replyToInquiry(
      req.adminUsername ?? 'unknown',
      parseInt(id, 10),
      body?.reply ?? '',
    );
  }
}
