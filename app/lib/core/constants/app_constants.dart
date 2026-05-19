class AppConstants {
  static const String appName = 'LingoLoop';
  static const String packageName = 'com.jiny.lingoloop';
  static const String defaultTargetLanguage = 'en';
  static const String defaultNativeLanguage = 'ko';
  static const String premiumMonthlyProductId = 'lingoloop_premium_monthly';

  /// Master switch for the paid plan. The initial release ships free-only;
  /// flip this to `true` in a later app update to open premium (quiz,
  /// quiz push, subscription screen). All premium entry points read this.
  static const bool premiumEnabled = false;

  // ── Social login config (fill from each provider console) ──────────────
  // Kakao: Native app key from Kakao Developers. Empty = Kakao disabled.
  static const String kakaoNativeAppKey = String.fromEnvironment(
    'KAKAO_NATIVE_APP_KEY',
    defaultValue: '',
  );
  // Google: OAuth *web* client id, required to receive an id_token the
  // server can verify. Empty = use platform default (may omit id_token).
  static const String googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue: '',
  );
}
