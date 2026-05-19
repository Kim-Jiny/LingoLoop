import { IsIn, IsString, MinLength } from 'class-validator';

export class SocialLinkDto {
  @IsString()
  @IsIn(['google', 'apple', 'kakao'])
  provider: 'google' | 'apple' | 'kakao';

  @IsString()
  @MinLength(1)
  token: string;
}
