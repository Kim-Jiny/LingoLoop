import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const supportedLanguages = ['ko', 'en', 'ja', 'es'];
export const learningTracks = [
  'beginner',
  'intermediate',
  'advanced',
  'toeic',
  'toefl',
  'conversation',
];

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

  @IsOptional()
  @IsIn(learningTracks)
  learningTrack?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  dailyGoal?: number;
}
