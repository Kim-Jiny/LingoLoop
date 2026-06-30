import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateAppConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  premiumMonthlyProductId?: string;

  @IsOptional()
  @IsBoolean()
  billingEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  iosProductGroupId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  androidBasePlanId?: string;

  @IsOptional()
  @IsBoolean()
  trialEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  trialDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}
