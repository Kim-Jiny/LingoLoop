import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service.js';
import { RefreshToken } from './refresh-token.entity.js';
import { AuthIdentity } from './auth-identity.entity.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { SocialLoginDto } from './dto/social-login.dto.js';
import { SocialLinkDto } from './dto/social-link.dto.js';
import { ClientInfoDto } from './dto/client-info.dto.js';
import { User, AuthProvider } from '../users/user.entity.js';
import { UserLanguageTrack } from '../users/user-language-track.entity.js';
import { Language } from '../sentences/language.entity.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import {
  SocialVerifierService,
  VerifiedIdentity,
} from './social/social-verifier.service.js';
import { AppleAuthService } from './social/apple-auth.service.js';
import { isValidTimeZone, zonedDateString } from '../../common/timezone.util.js';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(AuthIdentity)
    private identityRepo: Repository<AuthIdentity>,
    @InjectRepository(UserLanguageTrack)
    private userLangTrackRepo: Repository<UserLanguageTrack>,
    @InjectRepository(Language)
    private languageRepo: Repository<Language>,
    private socialVerifier: SocialVerifierService,
    private appleAuth: AppleAuthService,
  ) {}

  /**
   * `synchronize` is disabled outside development, so this newly added
   * table is created idempotently on boot (same pattern as the vocabulary
   * module). Avoids a manual migration step.
   */
  async onModuleInit() {
    await this.identityRepo.query(`
      CREATE TABLE IF NOT EXISTS ll_auth_identities (
        id SERIAL PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES ll_users(id) ON DELETE CASCADE,
        provider varchar NOT NULL,
        provider_id varchar NOT NULL,
        email text,
        apple_refresh_token text NULL,
        "createdAt" timestamp NOT NULL DEFAULT now()
      );
    `);
    await this.identityRepo.query(
      `ALTER TABLE ll_auth_identities
       ADD COLUMN IF NOT EXISTS apple_refresh_token text NULL`,
    );
    await this.identityRepo.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_ll_auth_identities_provider
       ON ll_auth_identities (provider, provider_id);`,
    );
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      password: hashedPassword,
      nickname: dto.nickname,
      ...(dto.timezone
        ? { timezone: this.requireValidTimezone(dto.timezone) }
        : {}),
      ...this.clientInfoPatch(dto.clientInfo),
    });

    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.password || !user.isActive) {
      // Defense in depth: even if a future change to the soft-delete
      // mangling let the original email slip through, a deactivated
      // user must never log back in.
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const patch: Partial<User> = this.clientInfoPatch(dto.clientInfo);
    if (dto.timezone && dto.timezone !== user.timezone) {
      const timezone = this.requireValidTimezone(dto.timezone);
      user.timezone = timezone;
      patch.timezone = timezone;
    }
    if (Object.keys(patch).length > 0) {
      await this.usersService.update(user.id, patch);
    }

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string, clientInfo?: ClientInfoDto) {
    const stored = await this.refreshTokenRepo.findOne({
      where: { token: refreshToken, isRevoked: false },
      relations: ['user'],
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revoke old token
    stored.isRevoked = true;
    await this.refreshTokenRepo.save(stored);

    const patch = this.clientInfoPatch(clientInfo);
    if (Object.keys(patch).length > 0) {
      await this.usersService.update(stored.user.id, patch);
    }

    return this.generateTokens(stored.user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // 다언어 (1.2 phase 2) — 핵심 정책:
    //  · learningTrack은 "현재 targetLanguage에 한정된 트랙"으로 해석.
    //    영구 저장은 ll_user_language_tracks(user_id, language_id).
    //    user.learningTrack 컬럼은 "현재 언어의 snapshot"이라 언어가
    //    바뀌면 새 언어의 stored track으로 자동 교체(없으면 null).
    //  · targetLanguage만 바꾸는 경우: 이전 언어의 오늘 active assignment
    //    는 보존(사용자 진도 보호). 새 언어는 다음 getToday가 알아서 fresh
    //    assignment를 만듦.
    //  · 같은 언어에서 트랙만 바꾸는 경우: 같은 언어의 active assignment를
    //    skipped로 정리 — 새 트랙 풀에서 문장 다시 뽑게.

    const patch: Partial<User> = {};
    if (dto.nickname != null) patch.nickname = dto.nickname;
    if (dto.targetLanguage != null) patch.targetLanguage = dto.targetLanguage;
    if (dto.nativeLanguage != null) patch.nativeLanguage = dto.nativeLanguage;
    if (dto.dailyGoal != null) patch.dailyGoal = dto.dailyGoal;
    // learningTrack은 아래 단계별 로직에서 결정/적용.

    if (Object.keys(patch).length === 0 && dto.learningTrack == null) {
      const current = await this.usersService.findById(userId);
      return this.serializeUser(current!);
    }

    const before = await this.usersService.findById(userId);
    if (!before) throw new NotFoundException('user not found');

    const newTargetLang =
      dto.targetLanguage ?? before.targetLanguage ?? 'en';
    const langChanged = newTargetLang !== (before.targetLanguage ?? 'en');

    // 새 언어의 stored track lookup (langChanged 케이스 + dto.learningTrack
    // 명시 안 했을 때 사용). 신규 언어이면 row 없음 → null.
    let storedTrackForNewLang: string | null = null;
    if (langChanged) {
      const lang = await this.languageRepo.findOne({
        where: { code: newTargetLang },
      });
      if (lang) {
        const row = await this.userLangTrackRepo.findOne({
          where: { userId, languageId: lang.id },
        });
        storedTrackForNewLang = row?.track ?? null;
      }
    }

    // 최종 learningTrack 결정:
    //  · dto.learningTrack 명시 → 그 값
    //  · langChanged이면 stored 사용 (null이면 null로 두고 클라가 트랙
    //    선택 화면으로 이동)
    //  · 그 외 → 기존 값 유지
    let newLearningTrack: string | null = before.learningTrack ?? null;
    if (dto.learningTrack != null) {
      newLearningTrack = dto.learningTrack;
    } else if (langChanged) {
      newLearningTrack = storedTrackForNewLang;
    }
    patch.learningTrack = newLearningTrack;

    const user = await this.usersService.update(userId, patch);

    // ll_user_language_tracks UPSERT — 현재 (user, newTargetLang) 페어의
    // track 값이 있을 때만. null이면 row 안 만듦(나중에 사용자가 트랙을
    // 고르면 만들어짐).
    if (newLearningTrack != null) {
      const lang = await this.languageRepo.findOne({
        where: { code: newTargetLang },
      });
      if (lang) {
        await this.userLangTrackRepo.query(
          `INSERT INTO ll_user_language_tracks
             (user_id, language_id, track, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, now(), now())
           ON CONFLICT (user_id, language_id) DO UPDATE
             SET track = EXCLUDED.track,
                 "updatedAt" = now()`,
          [userId, lang.id, newLearningTrack],
        );
      }
    }

    // 같은 언어 내 track 변경일 때만 오늘 active 정리. 언어 변경 케이스는
    // 이전 언어 진도 보존(사용자 명시 요구).
    const trackChangedSameLang =
      !langChanged &&
      dto.learningTrack != null &&
      (before.learningTrack ?? null) !== dto.learningTrack;
    if (trackChangedSameLang) {
      const today = zonedDateString(
        new Date(),
        user.timezone || 'Asia/Seoul',
      );
      // 컬럼명: user_id (snake) + "assignedDate" (camel, name override 없음).
      await this.identityRepo.query(
        `UPDATE ll_daily_assignments
           SET status = 'skipped'
         WHERE user_id = $1
           AND "assignedDate" = $2
           AND status = 'active'`,
        [userId, today],
      );
    }

    return this.serializeUser(user);
  }

  /**
   * 사용자가 각 언어에 대해 저장한 트랙 목록. ll_user_language_tracks
   * join + 언어 코드로 정렬. 클라이언트의 설정 화면/언어 전환 흐름에서
   * 활용.
   */
  async listLanguageTracks(userId: string) {
    const rows: Array<{ code: string; track: string }> =
      await this.userLangTrackRepo.query(
        `SELECT l.code, t.track
         FROM ll_user_language_tracks t
         JOIN ll_languages l ON l.id = t.language_id
         WHERE t.user_id = $1
         ORDER BY l.code ASC`,
        [userId],
      );
    return {
      tracks: rows.map((r) => ({
        languageCode: r.code,
        track: r.track,
      })),
    };
  }

  /**
   * Soft-deletes the calling user and revokes their Apple session.
   *
   * - Apple identities with a cached refresh_token are revoked at
   *   appleid.apple.com first (best-effort; failures don't block).
   * - UsersService.deleteAccount then mangles email + providerId,
   *   flips isActive to false, stamps deletedAt, revokes refresh
   *   tokens, and deactivates device tokens — all inside one
   *   transaction. See its docstring for the full SQL.
   *
   * App Store / Play Store both require this in-app deletion path.
   */
  async deleteSelf(userId: string): Promise<void> {
    // Revoke any cached Apple refresh tokens before mangling the
    // identity rows — once mangled, we lose nothing of value, but we
    // want Apple to know the user is gone first.
    const appleIdentities = await this.identityRepo.find({
      where: { userId, provider: 'apple' },
    });
    for (const id of appleIdentities) {
      if (id.appleRefreshToken) {
        await this.appleAuth.revokeRefreshToken(id.appleRefreshToken);
      }
    }
    await this.usersService.deleteAccount(userId);
  }

  /** Sign in (or sign up) with a social provider. */
  async socialLogin(dto: SocialLoginDto) {
    const v = await this.socialVerifier.verify(dto.provider, dto.token);

    const identity = await this.identityRepo.findOne({
      where: { provider: v.provider, providerId: v.providerId },
      relations: ['user'],
    });
    if (identity) {
      // Defense in depth: a deactivated user should never re-authenticate
      // even if the providerId mangling let the lookup slip through.
      if (!identity.user.isActive) {
        throw new UnauthorizedException('Invalid credentials');
      }
      const patch: Partial<User> = this.clientInfoPatch(dto.clientInfo);
      if (dto.timezone && dto.timezone !== identity.user.timezone) {
        patch.timezone = this.requireValidTimezone(dto.timezone);
      }
      if (Object.keys(patch).length > 0) {
        await this.usersService.update(identity.user.id, patch);
      }
      await this.maybeStoreAppleRefresh(identity, dto);
      return this.generateTokens(identity.user);
    }

    // New social identity → sign up. If the provider email is already a
    // registered account, block and tell them to link from settings.
    if (v.email) {
      const existing = await this.usersService.findByEmail(v.email);
      if (existing) {
        throw new ConflictException(
          '이미 가입된 이메일입니다. 일반 로그인 후 설정에서 소셜 계정을 연동해주세요.',
        );
      }
    }

    const email =
      v.email ?? `${v.provider}_${v.providerId}@social.lingoloop.app`;
    const user = await this.usersService.create({
      email,
      nickname: dto.nickname ?? this.defaultNickname(v),
      provider: this.toAuthProvider(v.provider),
      providerId: v.providerId,
      ...(dto.timezone
        ? { timezone: this.requireValidTimezone(dto.timezone) }
        : {}),
      ...this.clientInfoPatch(dto.clientInfo),
    });
    const created = await this.identityRepo.save(
      this.identityRepo.create({
        userId: user.id,
        provider: v.provider,
        providerId: v.providerId,
        email: v.email,
      }),
    );
    await this.maybeStoreAppleRefresh(created, dto);

    return this.generateTokens(user);
  }

  /**
   * Apple-only side effect: if the client passed an authorization_code
   * along with the identity token, exchange it for a refresh_token and
   * cache it on the identity row so a later account deletion can call
   * Apple's /auth/revoke. Failure is silently ignored — sign-in itself
   * must not depend on Apple's token endpoint being reachable.
   */
  private async maybeStoreAppleRefresh(
    identity: AuthIdentity,
    dto: SocialLoginDto,
  ): Promise<void> {
    if (dto.provider !== 'apple') return;
    if (!dto.authorizationCode) return;
    const result = await this.appleAuth.exchangeAuthorizationCode(
      dto.authorizationCode,
    );
    if (!result?.refreshToken) return;
    identity.appleRefreshToken = result.refreshToken;
    await this.identityRepo.save(identity);
  }

  /** Link a social identity to the currently authenticated account. */
  async linkIdentity(userId: string, dto: SocialLinkDto) {
    const v = await this.socialVerifier.verify(dto.provider, dto.token);

    const existing = await this.identityRepo.findOne({
      where: { provider: v.provider, providerId: v.providerId },
    });
    if (existing) {
      if (existing.userId === userId) {
        return { success: true, alreadyLinked: true, provider: v.provider };
      }
      // Already linked to / registered as another account — cannot move it.
      throw new ConflictException(
        '이미 다른 계정에 연동되었거나 가입된 소셜 계정입니다.',
      );
    }

    await this.identityRepo.save(
      this.identityRepo.create({
        userId,
        provider: v.provider,
        providerId: v.providerId,
        email: v.email,
      }),
    );
    return { success: true, provider: v.provider };
  }

  async listIdentities(userId: string) {
    const ids = await this.identityRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    const user = await this.usersService.findById(userId);
    return {
      hasPassword: !!user?.password,
      identities: ids.map((i) => ({
        provider: i.provider,
        email: i.email,
        linkedAt: i.createdAt,
      })),
    };
  }

  async unlinkIdentity(userId: string, provider: string) {
    const identity = await this.identityRepo.findOne({
      where: { userId, provider },
    });
    if (!identity) {
      throw new NotFoundException('연동되지 않은 소셜 계정입니다.');
    }
    const user = await this.usersService.findById(userId);
    const count = await this.identityRepo.count({ where: { userId } });
    if (!user?.password && count <= 1) {
      throw new BadRequestException(
        '마지막 로그인 수단은 해제할 수 없어요. 먼저 비밀번호를 설정하거나 다른 소셜을 연동하세요.',
      );
    }
    await this.identityRepo.remove(identity);
    return { success: true, provider };
  }

  private toAuthProvider(p: VerifiedIdentity['provider']): AuthProvider {
    switch (p) {
      case 'google':
        return AuthProvider.GOOGLE;
      case 'apple':
        return AuthProvider.APPLE;
      case 'kakao':
        return AuthProvider.KAKAO;
    }
  }

  private defaultNickname(v: VerifiedIdentity): string {
    if (v.email) return v.email.split('@')[0];
    return `${v.provider}_user`;
  }

  /**
   * 인증 흐름에서 받은 ClientInfo를 User row에 쓸 Partial로 변환.
   * 항상 `lastSeenAt`을 갱신 — clientInfo 객체가 비어 있어도 인증
   * 시점 자체는 기록해 "마지막 접속" 컬럼을 채움. 나머지 필드는
   * 들어온 값만 덮어씀 (빈 문자열도 그대로 — 운영자가 변경을 볼 수
   * 있도록).
   */
  private clientInfoPatch(info?: ClientInfoDto): Partial<User> {
    const patch: Partial<User> = { lastSeenAt: new Date() };
    if (!info) return patch;
    if (info.platform != null) patch.lastPlatform = info.platform;
    if (info.osVersion != null) patch.lastOsVersion = info.osVersion;
    if (info.appVersion != null) patch.lastAppVersion = info.appVersion;
    if (info.appBuild != null) patch.lastAppBuild = info.appBuild;
    if (info.deviceModel != null) patch.lastDeviceModel = info.deviceModel;
    return patch;
  }

  private requireValidTimezone(timezone: string): string {
    const trimmed = timezone.trim();
    if (!trimmed || !isValidTimeZone(trimmed)) {
      throw new BadRequestException('Invalid timezone');
    }
    return trimmed;
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION', '15m'),
    });

    const refreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshTokenRepo.save({
      userId: user.id,
      token: refreshToken,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      user: this.serializeUser(user),
    };
  }

  private serializeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      targetLanguage: user.targetLanguage,
      nativeLanguage: user.nativeLanguage,
      subscriptionTier: user.subscriptionTier,
      learningTrack: user.learningTrack ?? null,
      dailyGoal: user.dailyGoal ?? 3,
    };
  }
}
