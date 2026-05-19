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
}
