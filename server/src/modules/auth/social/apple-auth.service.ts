import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, importPKCS8 } from 'jose';

/**
 * Apple Sign In server-side operations:
 *  - exchangeAuthorizationCode: trade the one-shot `authorization_code`
 *    the client passes us during sign-in for an Apple `refresh_token`
 *    we can keep on file.
 *  - revokeRefreshToken: revoke that refresh_token at account-deletion
 *    time so Apple drops the linkage between LingoLoop and the user's
 *    Apple ID, per App Store Review guideline 5.1.1(v).
 *
 * Requires four env vars to actually hit Apple:
 *   APPLE_TEAM_ID       — 10-char Apple Developer Team ID
 *   APPLE_KEY_ID        — Key ID of the .p8 you generated for "Sign In with Apple"
 *   APPLE_PRIVATE_KEY   — PEM contents of the .p8 (multiline; escape \n with \\n if env-managed)
 *   APPLE_CLIENT_ID     — Bundle id used as Sign-In Service ID (e.g. com.jiny.lingoloop)
 *
 * If any are missing the methods log + no-op, so dev environments
 * without Apple credentials don't crash account deletion.
 */
@Injectable()
export class AppleAuthService {
  private readonly logger = new Logger(AppleAuthService.name);
  private readonly teamId?: string;
  private readonly keyId?: string;
  private readonly privateKey?: string;
  private readonly clientId?: string;

  constructor(config: ConfigService) {
    this.teamId = config.get<string>('APPLE_TEAM_ID');
    this.keyId = config.get<string>('APPLE_KEY_ID');
    // Env files commonly escape multiline PEMs as a single line of
    // `\n` literals; YAML / direct paste preserves real newlines.
    // Accept both — only un-escape when there are no real newlines yet.
    const rawKey = config.get<string>('APPLE_PRIVATE_KEY');
    this.privateKey = rawKey?.includes('\n')
      ? rawKey
      : rawKey?.replace(/\\n/g, '\n');
    this.clientId = config.get<string>('APPLE_CLIENT_ID');
  }

  private isConfigured(): boolean {
    return !!(this.teamId && this.keyId && this.privateKey && this.clientId);
  }

  /**
   * Trades the one-shot `authorization_code` the client received from
   * Sign in with Apple for a refresh_token. Returns null if the
   * exchange fails or Apple credentials are not configured.
   */
  async exchangeAuthorizationCode(
    code: string,
  ): Promise<{ refreshToken: string } | null> {
    if (!this.isConfigured()) {
      this.logger.debug(
        'Apple exchange skipped — APPLE_* env not configured',
      );
      return null;
    }
    if (!code) return null;
    try {
      const clientSecret = await this.buildClientSecret();
      const body = new URLSearchParams({
        client_id: this.clientId!,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
      });
      const res = await fetch('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(
          `Apple token exchange failed (${res.status}): ${text}`,
        );
        return null;
      }
      const data: any = await res.json();
      return data?.refresh_token
        ? { refreshToken: String(data.refresh_token) }
        : null;
    } catch (e: any) {
      this.logger.warn(`Apple token exchange error: ${e.message}`);
      return null;
    }
  }

  /**
   * Revokes an Apple refresh_token. Best-effort: swallows network or
   * 4xx errors so account deletion never blocks on Apple's API.
   */
  async revokeRefreshToken(refreshToken: string): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.debug('Apple revoke skipped — env not configured');
      return false;
    }
    if (!refreshToken) return false;
    try {
      const clientSecret = await this.buildClientSecret();
      const body = new URLSearchParams({
        client_id: this.clientId!,
        client_secret: clientSecret,
        token: refreshToken,
        token_type_hint: 'refresh_token',
      });
      const res = await fetch('https://appleid.apple.com/auth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) {
        // Don't echo the response body — Apple's error JSON sometimes
        // carries provider-specific identifiers; the status is enough
        // to debug the common failure modes (4xx config, 5xx transient).
        this.logger.warn(`Apple revoke failed: HTTP ${res.status}`);
        return false;
      }
      return true;
    } catch (e: any) {
      this.logger.warn(`Apple revoke error: ${e.message}`);
      return false;
    }
  }

  /**
   * Builds the short-lived client_secret JWT Apple expects on both
   * /auth/token and /auth/revoke. Signed with ES256 using our .p8.
   * Valid for ~10 minutes (well under Apple's 6-month max).
   */
  private async buildClientSecret(): Promise<string> {
    const pkcs8 = await importPKCS8(this.privateKey!, 'ES256');
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: this.keyId! })
      .setIssuer(this.teamId!)
      .setIssuedAt(now)
      .setExpirationTime(now + 600)
      .setAudience('https://appleid.apple.com')
      .setSubject(this.clientId!)
      .sign(pkcs8);
  }
}
