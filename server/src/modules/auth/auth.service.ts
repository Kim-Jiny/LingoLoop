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
import { User, AuthProvider } from '../users/user.entity.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import {
  SocialVerifierService,
  VerifiedIdentity,
} from './social/social-verifier.service.js';

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
    private socialVerifier: SocialVerifierService,
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
        "createdAt" timestamp NOT NULL DEFAULT now()
      );
    `);
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
      ...(dto.timezone ? { timezone: dto.timezone } : {}),
    });

    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (dto.timezone && dto.timezone !== user.timezone) {
      user.timezone = dto.timezone;
      await this.usersService.update(user.id, { timezone: dto.timezone });
    }

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string) {
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

    return this.generateTokens(stored.user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Only touch fields that were actually provided. Passing null/undefined
    // through would null a NOT NULL column or wipe the nickname.
    const patch: Partial<User> = {};
    if (dto.nickname != null) patch.nickname = dto.nickname;
    if (dto.targetLanguage != null) patch.targetLanguage = dto.targetLanguage;
    if (dto.nativeLanguage != null) patch.nativeLanguage = dto.nativeLanguage;
    if (dto.learningTrack != null) patch.learningTrack = dto.learningTrack;
    if (dto.dailyGoal != null) patch.dailyGoal = dto.dailyGoal;

    if (Object.keys(patch).length === 0) {
      const current = await this.usersService.findById(userId);
      return this.serializeUser(current!);
    }

    const user = await this.usersService.update(userId, patch);
    return this.serializeUser(user);
  }

  /** Sign in (or sign up) with a social provider. */
  async socialLogin(dto: SocialLoginDto) {
    const v = await this.socialVerifier.verify(dto.provider, dto.token);

    const identity = await this.identityRepo.findOne({
      where: { provider: v.provider, providerId: v.providerId },
      relations: ['user'],
    });
    if (identity) {
      if (dto.timezone && dto.timezone !== identity.user.timezone) {
        await this.usersService.update(identity.user.id, {
          timezone: dto.timezone,
        });
      }
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
      ...(dto.timezone ? { timezone: dto.timezone } : {}),
    });
    await this.identityRepo.save(
      this.identityRepo.create({
        userId: user.id,
        provider: v.provider,
        providerId: v.providerId,
        email: v.email,
      }),
    );

    return this.generateTokens(user);
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
