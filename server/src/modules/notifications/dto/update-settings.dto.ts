import {
  IsBoolean,
  IsNumber,
  IsString,
  IsOptional,
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
  activeStartTime?: string; // HH:mm format

  @IsString()
  @IsOptional()
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
