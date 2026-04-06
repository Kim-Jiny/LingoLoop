import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

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
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}
