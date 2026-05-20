import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class SocialLoginDto {
  @IsString()
  @IsIn(['google', 'apple', 'kakao'])
  provider: 'google' | 'apple' | 'kakao';

  @IsString()
  @MinLength(1)
  token: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  /**
   * Apple-only: the one-shot authorization_code returned by
   * SignInWithApple alongside the identity token. We exchange it for a
   * refresh_token so we can revoke the session at account deletion.
   */
  @IsOptional()
  @IsString()
  authorizationCode?: string;
}
