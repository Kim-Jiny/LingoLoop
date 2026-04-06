import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class VerifyPurchaseDto {
  @IsString()
  @MinLength(1)
  productId: string;

  @IsString()
  purchaseId: string;

  @IsOptional()
  @IsString()
  transactionDate?: string;

  @IsString()
  @IsIn(['app_store', 'play_store'])
  source: string;

  @IsString()
  status: string;

  @IsString()
  serverVerificationData: string;

  @IsString()
  localVerificationData: string;

  @IsBoolean()
  isRestore: boolean;
}
