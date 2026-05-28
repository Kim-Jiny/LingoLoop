import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AdminAccount } from './admin-account.entity.js';

const COOKIE_NAME = 'admin_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class AdminAuthService implements OnModuleInit {
  private readonly logger = new Logger(AdminAuthService.name);
  private readonly secret: string;

  constructor(
    @InjectRepository(AdminAccount)
    private readonly repo: Repository<AdminAccount>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    const configuredSecret = config.get<string>('ADMIN_SESSION_SECRET');
    if (process.env.NODE_ENV === 'production' && !configuredSecret) {
      throw new InternalServerErrorException(
        'ADMIN_SESSION_SECRET must be set in production',
      );
    }
    this.secret =
      configuredSecret ??
      `dev-admin-secret-${config.get<string>('DB_DATABASE', 'lingoloop')}`;
  }

  async onModuleInit() {
    // synchronize is off in prod; create the table on demand and bootstrap
    // the first operator only from explicit environment variables.
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS admin_account (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        username varchar NOT NULL UNIQUE,
        password_hash varchar NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);

    const existing = await this.repo.count();
    if (existing === 0) {
      const username = process.env.ADMIN_BOOTSTRAP_USERNAME;
      const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
      if (!username || !password) {
        if (process.env.NODE_ENV === 'production') {
          throw new InternalServerErrorException(
            'ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD must be set for first production boot',
          );
        }
        this.logger.warn(
          'No admin account exists. Set ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD to create one.',
        );
        return;
      }
      const passwordHash = await bcrypt.hash(password, 10);
      await this.repo.save(
        this.repo.create({ username: username.trim(), passwordHash }),
      );
      this.logger.log(`Seeded bootstrap admin account: ${username.trim()}`);
    }
  }

  /** Verifies credentials. Throws UnauthorizedException on bad input. */
  async verify(username: string, password: string): Promise<AdminAccount> {
    const account = await this.repo.findOne({ where: { username } });
    if (!account) {
      throw new UnauthorizedException('잘못된 아이디 또는 비밀번호');
    }
    const ok = await bcrypt.compare(password, account.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('잘못된 아이디 또는 비밀번호');
    }
    return account;
  }

  /**
   * Encodes a signed session cookie value: `<b64url(username)>.expiresMs.sig`.
   *
   * Username은 base64url로 인코딩 — '.' / ',' / ';' / '=' 같이 쿠키나
   * separator로 충돌할 문자가 든 username (예: 'firstname.lastname')도
   * 안전. base64url 알파벳은 [A-Za-z0-9_-]뿐이라 separator '.'와
   * 충돌하지 않음. HMAC payload는 raw username 그대로 사용해 서명.
   */
  signSession(username: string, ttlMs: number = SESSION_TTL_MS): string {
    const expires = String(Date.now() + ttlMs);
    const sig = this.sign(`${username}.${expires}`);
    const encUsername = Buffer.from(username, 'utf8').toString('base64url');
    return `${encUsername}.${expires}.${sig}`;
  }

  /** Returns the admin username if the cookie is valid + not expired. */
  verifySession(cookieValue: string | undefined | null): string | null {
    if (!cookieValue) return null;
    const parts = cookieValue.split('.');
    if (parts.length !== 3) return null;
    const [encUsername, expires, sig] = parts;
    if (!encUsername || !expires || !sig) return null;
    let username: string;
    try {
      username = Buffer.from(encUsername, 'base64url').toString('utf8');
    } catch {
      return null;
    }
    if (!username) return null;

    const expected = this.sign(`${username}.${expires}`);
    if (!safeEqual(sig, expected)) return null;
    if (Number(expires) < Date.now()) return null;
    return username;
  }

  /** Parses the admin_session cookie out of the raw Cookie header. */
  readSessionFromCookieHeader(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) return null;
    for (const piece of cookieHeader.split(';')) {
      const [k, ...rest] = piece.trim().split('=');
      if (k === COOKIE_NAME) return rest.join('=');
    }
    return null;
  }

  /** Set-Cookie value for a fresh login. */
  buildSetCookie(username: string): string {
    const v = this.signSession(username);
    const maxAge = Math.floor(SESSION_TTL_MS / 1000);
    // HttpOnly so JS can't read it; SameSite=Lax so form POST works.
    // Secure is set when behind HTTPS; for local dev we keep it optional.
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `${COOKIE_NAME}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
  }

  /** Set-Cookie value that clears the session. */
  buildClearCookie(): string {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  }

  static get cookieName(): string {
    return COOKIE_NAME;
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url');
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
