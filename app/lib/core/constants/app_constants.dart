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
  // Google: OAuth *web* client id — google_sign_in mints an id_token with
  // this as the audience so the server can verify it. (OAuth client IDs are
  // public identifiers, safe to ship; override via --dart-define if needed.)
  static const String googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue:
        '323083798915-o9oc8bjltut8sjrki4lufmfmaiinbhqu.apps.googleusercontent.com',
  );
}
