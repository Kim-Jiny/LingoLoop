import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class SocialLinkDto {
  @IsString()
  @IsIn(['google', 'apple', 'kakao'])
  provider: 'google' | 'apple' | 'kakao';

  @IsString()
  @MinLength(1)
  token: string;

  /**
   * Apple-only one-shot code. When an existing account links Apple from
   * settings, we exchange this for a refresh_token so account deletion
   * can revoke the Apple session — same as the sign-up/sign-in path.
   */
  @IsOptional()
  @IsString()
  authorizationCode?: string;
}
