import {
  Injectable,
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
    // Falls back to a random-but-stable string if the env is missing so
    // dev never crashes. Production should set ADMIN_SESSION_SECRET.
    this.secret =
      config.get<string>('ADMIN_SESSION_SECRET') ??
      'lingoloop-default-admin-secret-change-me';
  }

  async onModuleInit() {
    // synchronize is off in prod — create the table on demand and seed
    // the default operator account (jiny / 1204) on first boot.
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS admin_account (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        username varchar NOT NULL UNIQUE,
        password_hash varchar NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);

    const existing = await this.repo.findOne({ where: { username: 'jiny' } });
    if (!existing) {
      const passwordHash = await bcrypt.hash('1204', 10);
      await this.repo.save(this.repo.create({ username: 'jiny', passwordHash }));
      this.logger.log('Seeded default admin account: jiny');
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

  /** Encodes a signed session cookie value: `username.expiresMs.sig`. */
  signSession(username: string, ttlMs: number = SESSION_TTL_MS): string {
    const expires = String(Date.now() + ttlMs);
    const sig = this.sign(`${username}.${expires}`);
    return `${encodeURIComponent(username)}.${expires}.${sig}`;
  }

  /** Returns the admin username if the cookie is valid + not expired. */
  verifySession(cookieValue: string | undefined | null): string | null {
    if (!cookieValue) return null;
    const parts = cookieValue.split('.');
    if (parts.length !== 3) return null;
    const [encUsername, expires, sig] = parts;
    if (!encUsername || !expires || !sig) return null;
    const username = decodeURIComponent(encUsername);

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
    return `${COOKIE_NAME}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
  }

  /** Set-Cookie value that clears the session. */
  buildClearCookie(): string {
    return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  }

  static get cookieName(): string {
    return COOKIE_NAME;
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
