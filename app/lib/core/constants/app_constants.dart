class AppConstants {
  static const String appName = 'LingoLoop';
  static const String packageName = 'com.jiny.lingoloop';
  static const String defaultTargetLanguage = 'en';
  static const String defaultNativeLanguage = 'ko';
  static const String premiumMonthlyProductId = 'lingoloop_premium_monthly';

  /// Master switch for the paid plan. Opens premium entry points
  /// (subscription screen, quiz, quiz push). Server-side verification
  /// runs through StoreKit 2 JWS / Play Billing v6, so flipping this
  /// alone never grants access — only a verified purchase does.
  static const bool premiumEnabled = true;

  // ── Social login config (fill from each provider console) ──────────────
  // Kakao: Native app key from Kakao Developers. Empty = Kakao disabled.
  static const String kakaoNativeAppKey = String.fromEnvironment(
    'KAKAO_NATIVE_APP_KEY',
    defaultValue: '19046586f7f389747bf7093c5f253e9e',
  );
  // Google: OAuth *web* client id — google_sign_in mints an id_token with
  // this as the audience so the server can verify it. (OAuth client IDs are
  // public identifiers, safe to ship; override via --dart-define if needed.)
  static const String googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue:
        '323083798915-o9oc8bjltut8sjrki4lufmfmaiinbhqu.apps.googleusercontent.com',
  );
}
