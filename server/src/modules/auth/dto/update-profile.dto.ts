import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  learningTracks,
  nativeLanguages,
  targetLanguages,
} from '../../../common/language-options.js';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  nickname?: string;

  @IsOptional()
  @IsIn(targetLanguages)
  targetLanguage?: string;

  @IsOptional()
  @IsIn(nativeLanguages)
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
