import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const supportedLanguages = ['ko', 'en', 'ja', 'es'];

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  nickname?: string;

  @IsOptional()
  @IsIn(supportedLanguages)
  targetLanguage?: string;

  @IsOptional()
  @IsIn(supportedLanguages)
  nativeLanguage?: string;
}
