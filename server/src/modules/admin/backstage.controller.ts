import {
  Body,
  Controller,
  Get,
  Header,
  HttpStatus,
  Param,
  Post,
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
  renderLayout,
  renderLogin,
  renderOverview,
  renderPushesList,
  renderSubscriptions,
  renderSubscriptionVerification,
  renderUserDetail,
  renderUsersList,
} from './backstage.pages.js';

/**
 * Multi-page admin dashboard mounted at `/backstage`. All page routes
 * are gated by the HMAC-signed `admin_session` cookie via
 * AdminAuthService; the underlying data APIs are gated by
 * AdminSessionGuard.
 */
@Controller('backstage')
export class BackstageController {
  constructor(private readonly auth: AdminAuthService) {}

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
    try {
      await this.auth.verify(u, p);
    } catch {
      res.status(401);
      this.html(res, renderLogin('아이디 또는 비밀번호가 올바르지 않아요.'));
      return;
    }
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
  ) {
    const username = this.currentUser(req);
    if (!username) return res.redirect(HttpStatus.FOUND, '/backstage/login');
    this.renderPage(res, {
      adminUsername: username,
      activeNav: 'content',
      title: `콘텐츠 · ${track}`,
      body: renderContentTrack(track),
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
