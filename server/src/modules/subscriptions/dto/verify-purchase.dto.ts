import { IsIn, IsString, MinLength } from 'class-validator';

/**
 * Minimal proof-of-purchase payload from the app. The store-side data we
 * need lives in `serverVerificationData`:
 *   - iOS  (StoreKit 2)   → JWSRepresentation of the transaction
 *   - iOS  (legacy SK1)   → base64-encoded app receipt (unsupported)
 *   - Android (Billing 6) → purchaseToken
 * Everything else we used to take from the client (transactionDate,
 * purchaseId, localVerificationData, status, isRestore) is recomputed
 * server-side from the verified store response, so they're omitted.
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
}
