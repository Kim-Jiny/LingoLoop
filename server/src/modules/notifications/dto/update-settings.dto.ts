import {
  IsBoolean,
  IsNumber,
  IsString,
  IsOptional,
  Matches,
  Min,
  Max,
} from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(15)
  @Max(480)
  frequencyMinutes?: number;

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  activeStartTime?: string; // HH:mm format

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  activeEndTime?: string; // HH:mm format

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  quizPushRatio?: number;
}
