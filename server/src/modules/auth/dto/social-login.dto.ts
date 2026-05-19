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
}
