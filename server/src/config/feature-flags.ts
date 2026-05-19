/**
 * Server-side feature flags. Mirrors the app's `AppConstants.premiumEnabled`.
 *
 * The initial release is free-only: premium features (quiz, quiz push) must
 * not be emitted by the backend. Defaults to disabled so a missing env var
 * never accidentally turns the paid plan on. Flip via `PREMIUM_ENABLED=true`
 * in the server env when launching the paid plan.
 */
export const isPremiumEnabled = (): boolean =>
  process.env.PREMIUM_ENABLED === 'true';
