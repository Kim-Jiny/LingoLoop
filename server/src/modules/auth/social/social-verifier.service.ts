import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { SocialProvider } from '../auth-identity.entity.js';

export interface VerifiedIdentity {
  provider: SocialProvider;
  providerId: string;
  email: string | null;
}

@Injectable()
export class SocialVerifierService {
  private readonly logger = new Logger(SocialVerifierService.name);
  private readonly appleJwks = createRemoteJWKSet(
    new URL('https://appleid.apple.com/auth/keys'),
  );

  constructor(private config: ConfigService) {}

  async verify(
    provider: SocialProvider,
    token: string,
  ): Promise<VerifiedIdentity> {
    switch (provider) {
      case 'google':
        return this.verifyGoogle(token);
      case 'apple':
        return this.verifyApple(token);
      case 'kakao':
        return this.verifyKakao(token);
      default:
        throw new UnauthorizedException('Unsupported provider');
    }
  }

  /**
   * Verify a Google ID token via Google's tokeninfo endpoint (Google checks
   * the signature & expiry server-side). We then enforce the audience.
   */
  private async verifyGoogle(idToken: string): Promise<VerifiedIdentity> {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!res.ok) {
      throw new UnauthorizedException('Invalid Google token');
    }
    const data: any = await res.json();

    const allowed = (this.config.get<string>('GOOGLE_CLIENT_IDS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.length > 0 && !allowed.includes(data.aud)) {
      throw new UnauthorizedException('Google token audience mismatch');
    }
    if (allowed.length === 0) {
      this.logger.warn(
        'GOOGLE_CLIENT_IDS not set — skipping audience check (configure before launch).',
      );
    }
    if (!data.sub) {
      throw new UnauthorizedException('Invalid Google token');
    }

    return {
      provider: 'google',
      providerId: String(data.sub),
      email: data.email ?? null,
    };
  }

  /** Verify an Apple identity token (JWT) against Apple's JWKS. */
  private async verifyApple(identityToken: string): Promise<VerifiedIdentity> {
    const audience =
      this.config.get<string>('APPLE_AUDIENCE') ?? 'com.jiny.lingoloop';
    try {
      const { payload } = await jwtVerify(identityToken, this.appleJwks, {
        issuer: 'https://appleid.apple.com',
        audience,
      });
      if (!payload.sub) {
        throw new UnauthorizedException('Invalid Apple token');
      }
      return {
        provider: 'apple',
        providerId: String(payload.sub),
        email: (payload.email as string | undefined) ?? null,
      };
    } catch (e: any) {
      this.logger.warn(`Apple token verification failed: ${e.message}`);
      throw new UnauthorizedException('Invalid Apple token');
    }
  }

  /** Verify a Kakao access token by calling the Kakao user API. */
  private async verifyKakao(accessToken: string): Promise<VerifiedIdentity> {
    const res = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new UnauthorizedException('Invalid Kakao token');
    }
    const data: any = await res.json();
    if (!data.id) {
      throw new UnauthorizedException('Invalid Kakao token');
    }
    return {
      provider: 'kakao',
      providerId: String(data.id),
      email: data.kakao_account?.email ?? null,
    };
  }
}
