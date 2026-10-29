import {
  Body,
  Controller,
  Get,
  Header,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { AdminAuthService } from './admin-auth.service.js';
import {
  ActiveNav,
  PageBody,
  renderContentIndex,
  renderContentTrack,
  renderInquiriesList,
  renderLayout,
  renderLogin,
  renderOverview,
  renderPushesList,
  renderQuizProblemsList,
  renderStats,
  renderSubscriptions,
  renderSubscriptionVerification,
  renderUserDetail,
  renderUsersList,
  renderWordsList,
} from './backstage.pages.js';

/**
 * Multi-page admin dashboard mounted at `/backstage`. All page routes
 * are gated by the HMAC-signed `admin_session` cookie via
 * AdminAuthService; the underlying data APIs are gated by
 * AdminSessionGuard.
 */
const LOGIN_MAX_FAILS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

@Controller('backstage')
export class BackstageController {
  constructor(private readonly auth: AdminAuthService) {}

  /** Failed-login timestamps per username (in-memory, single instance). */
  private readonly loginFails = new Map<string, number[]>();

  private recentFails(key: string): number[] {
    const cutoff = Date.now() - LOGIN_WINDOW_MS;
    const recent = (this.loginFails.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length) this.loginFails.set(key, recent);
    else this.loginFails.delete(key);
    return recent;
  }

  // --- Auth -----------------------------------------------------------

  @Public()
  @Get('login')
  @Header('Content-Type', 'text/html; charset=utf-8')
  loginPage(@Req() req: Request, @Res() res: Response) {
    if (this.currentUser(req)) {
      res.redirect(HttpStatus.FOUND, '/backstage');
      return;
    }
    this.html(res, renderLogin(null));
  }

  @Public()
  @Post('login')
  async login(
    @Body('username') username: string,
    @Body('password') password: string,
    @Res() res: Response,
  ) {
    const u = (username || '').trim();
    const p = password || '';
    const key = u.toLowerCase().slice(0, 64);
    if (this.recentFails(key).length >= LOGIN_MAX_FAILS) {
      res.status(429);
      this.html(
        res,
        renderLogin('시도 횟수가 많아요. 잠시 후 다시 시도해 주세요.'),
      );
      return;
    }
    try {
      await this.auth.verify(u, p);
    } catch {
      if (this.loginFails.size > 5000) this.loginFails.clear();
      this.loginFails.set(key, [...this.recentFails(key), Date.now()]);
      res.status(401);
      this.html(res, renderLogin('아이디 또는 비밀번호가 올바르지 않아요.'));
      return;
    }
    this.loginFails.delete(key);
    res.setHeader('Set-Cookie', this.auth.buildSetCookie(u));
    res.redirect(HttpStatus.FOUND, '/backstage');
  }

  @Public()
  @Post('logout')
  logout(@Res() res: Response) {
    res.setHeader('Set-Cookie', this.auth.buildClearCookie());
    res.redirect(HttpStatus.FOUND, '/backstage/login');
  }

  // --- Pages ----------------------------------------------------------

  @Public()
  @Get()
  index(@Req() req: Request, @Res() res: Response) {
    const username = this.currentUser(req);
    if (!username) return res.redirect(HttpStatus.FOUND, '/backstage/login');
    this.renderPage(res, {
      adminUsername: username,
      activeNav: 'overview',
      title: '개요',
      body: renderOverview(),
    });
  }

  @Public()
  @Get('stats')
  stats(@Req() req: Request, @Res() res: Response) {
    const username = this.currentUser(req);
    if (!username) return res.redirect(HttpStatus.FOUND, '/backstage/login');
    this.renderPage(res, {
      adminUsername: username,
      activeNav: 'stats',
      title: '통계',
      body: renderStats(),
    });
  }

  @Public()
  @Get('users')
  users(@Req() req: Request, @Res() res: Response) {
    const username = this.currentUser(req);
    if (!username) return res.redirect(HttpStatus.FOUND, '/backstage/login');
    this.renderPage(res, {
      adminUsername: username,
      activeNav: 'users',
      title: '유저',
      body: renderUsersList(),
    });
  }

  @Public()
  @Get('users/:id')
  userDetail(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const username = this.currentUser(req);
    if (!username) return res.redirect(HttpStatus.FOUND, '/backstage/login');
    this.renderPage(res, {
      adminUsername: username,
      activeNav: 'users',
      title: '유저 상세',
      body: renderUserDetail(id),
    });
  }

  @Public()
  @Get('content')
  content(@Req() req: Request, @Res() res: Response) {
    const username = this.currentUser(req);
    if (!username) return res.redirect(HttpStatus.FOUND, '/backstage/login');
    this.renderPage(res, {
      adminUsername: username,
      activeNav: 'content',
      title: '콘텐츠',
      body: renderContentIndex(),
    });
  }

  @Public()
  @Get('content/:track')
  contentTrack(
    @Param('track') track: string,
    @Req() req: Request,
    @Res() res: Response,
    @Query('lang') lang?: string,
  ) {
    const username = this.currentUser(req);
    if (!username) return res.redirect(HttpStatus.FOUND, '/backstage/login');
    this.renderPage(res, {
      adminUsername: username,
      activeNav: 'content',
      title: `콘텐츠 · ${track}`,
      body: renderContentTrack(track, lang ?? 'en'),
    });
  }

  @Public()
  @Get('words')
  words(@Req() req: Request, @Res() res: Response) {
    const username = this.currentUser(req);
    if (!username) return res.redirect(HttpStatus.FOUND, '/backstage/login');
    this.renderPage(res, {
      adminUsername: username,
      activeNav: 'words',
      title: '단어',
      body: renderWordsList(),
    });
  }

  @Public()
  @Get('quiz')
  quiz(@Req() req: Request, @Res() res: Response) {
    const username = this.currentUser(req);
    if (!username) return res.redirect(HttpStatus.FOUND, '/backstage/login');
    this.renderPage(res, {
      adminUsername: username,
      activeNav: 'quiz',
      title: '퀴즈 문제',
      body: renderQuizProblemsList(),
    });
  }

  @Public()
  @Get('pushes')
  pushes(@Req() req: Request, @Res() res: Response) {
    const username = this.currentUser(req);
    if (!username) return res.redirect(HttpStatus.FOUND, '/backstage/login');
    this.renderPage(res, {
      adminUsername: username,
      activeNav: 'pushes',
      title: '푸시 히스토리',
      body: renderPushesList(),
    });
  }

  @Public()
  @Get('subscriptions')
  subscriptions(@Req() req: Request, @Res() res: Response) {
    const username = this.currentUser(req);
    if (!username) return res.redirect(HttpStatus.FOUND, '/backstage/login');
    this.renderPage(res, {
      adminUsername: username,
      activeNav: 'subscriptions',
      title: '구독·매출',
      body: renderSubscriptions(),
    });
  }

  @Public()
  @Get('subscriptions/verification')
  subscriptionsVerification(@Req() req: Request, @Res() res: Response) {
    const username = this.currentUser(req);
    if (!username) return res.redirect(HttpStatus.FOUND, '/backstage/login');
    this.renderPage(res, {
      adminUsername: username,
      activeNav: 'subscriptions',
      title: '결제 검증 로그',
      body: renderSubscriptionVerification(),
    });
  }

  @Public()
  @Get('inquiries')
  inquiries(@Req() req: Request, @Res() res: Response) {
    const username = this.currentUser(req);
    if (!username) return res.redirect(HttpStatus.FOUND, '/backstage/login');
    this.renderPage(res, {
      adminUsername: username,
      activeNav: 'inquiries',
      title: '문의',
      body: renderInquiriesList(),
    });
  }

  // --- Helpers --------------------------------------------------------

  private currentUser(req: Request): string | null {
    return this.auth.verifySession(
      this.auth.readSessionFromCookieHeader(req.headers.cookie),
    );
  }

  private html(res: Response, body: string) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8').send(body);
  }

  private renderPage(
    res: Response,
    opts: {
      adminUsername: string;
      activeNav: ActiveNav;
      title: string;
      body: PageBody;
    },
  ) {
    this.html(
      res,
      renderLayout({
        adminUsername: opts.adminUsername,
        activeNav: opts.activeNav,
        title: opts.title,
        content: opts.body.content,
        scripts: opts.body.scripts,
      }),
    );
  }
}
