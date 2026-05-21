import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

/**
 * Proof-of-purchase payload from the app. Only three fields are used
 * server-side; the rest are kept @IsOptional() for forward-compat with
 * v1.0.0+2 clients (which sent the legacy shape).
 *
 *   - iOS  (StoreKit 2)   → JWSRepresentation of the transaction
 *   - Android (Billing 6) → purchaseToken
 *
 * Everything else (transactionDate, purchaseId, status, isRestore,
 * localVerificationData) is recomputed from the verified store
 * response. Global ValidationPipe has forbidNonWhitelisted:true so
 * undeclared fields would 400 — these decorators stop that from
 * happening when an older client is still on the wire.
 */
export class VerifyPurchaseDto {
  @IsString()
  @MinLength(1)
  productId: string;

  @IsString()
  @IsIn(['app_store', 'play_store'])
  source: string;

  @IsString()
  @MinLength(1)
  serverVerificationData: string;

  // ── legacy fields, accepted but ignored ─────────────────────────
  @IsOptional()
  @IsString()
  purchaseId?: string;

  @IsOptional()
  @IsString()
  transactionDate?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  localVerificationData?: string;

  @IsOptional()
  @IsBoolean()
  isRestore?: boolean;
}
