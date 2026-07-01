class AppConstants {
  static const String appName = 'LingoLoop';
  static const String packageName = 'com.jiny.lingoloop';
  static const String defaultTargetLanguage = 'en';
  static const String defaultNativeLanguage = 'ko';
  static const String premiumMonthlyProductId = 'lingoloop_premium_monthly';
  static const String privacyPolicyUrl = 'https://lingo.jiny.shop/privacy';
  static const String termsOfUseUrl = 'https://lingo.jiny.shop/terms';

  // ── 사업자 정보 (전자상거래법 제13조 신원정보 표시) ──────────────────
  // 모바일콘텐츠 제공사업자 고지 요건. 앱 내 "사업자 정보" 화면 + 약관
  // (docs/terms-of-use-ko.md) 양쪽에 노출. 변경 시 두 곳을 함께 수정.
  static const String bizName = '진소프트';
  static const String bizOwner = '김미진';
  static const String bizRegistrationNo = '827-53-01093';
  static const String bizMailOrderNo = '제 2026-고양덕양구-0658호';
  static const String bizAddress = '경기도 고양시 덕양구 충경로 138, 303동 508호';
  static const String bizPhone = '010-4676-2773';
  static const String bizEmail = 'kjinyz@naver.com';

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
