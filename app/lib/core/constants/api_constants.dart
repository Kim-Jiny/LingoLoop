class ApiConstants {
  // Release/default points at production. run_debug.sh overrides this with
  // the LAN IP via --dart-define=API_BASE_URL=http://<ip>:3000 for local dev.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://lingo.jiny.shop',
  );
  static const String authRegister = '/api/auth/register';
  static const String authLogin = '/api/auth/login';
  static const String authRefresh = '/api/auth/refresh';
  static const String authMe = '/api/auth/me';
  static const String authUpdateMe = '/api/auth/me';
  static const String authSocial = '/api/auth/social';
  static const String authSocialLink = '/api/auth/social/link';
  static const String authIdentities = '/api/auth/identities';
  static const String sentencesToday = '/api/sentences/today';
  static const String sentencesHistory = '/api/sentences/history';
  static const String sentencesSearch = '/api/sentences/search';
  static const String sentenceAssignmentComplete = '/api/sentences/assignments';
  static const String adminSeed = '/api/admin/seed';
  static const String quizDaily = '/api/quiz/daily';
  static const String quizSubmit = '/api/quiz'; // POST /api/quiz/:id/submit
  static const String quizHistory = '/api/quiz/history';
  static const String quizProgress = '/api/quiz/progress';
  static const String quizReview = '/api/quiz/review';
  static const String quizWordsDaily = '/api/quiz/words/daily';
  static const String quizWordsListeningDaily = '/api/quiz/words/listening/daily';
  static const String quizSentenceListeningDaily = '/api/quiz/sentence/listening/daily';
  static const String progressStats = '/api/progress/stats';
  static const String progressSentences = '/api/progress/sentences';
  static const String progressExposure = '/api/progress/exposure';
  static const String progressReview = '/api/progress/review';
  static const String progressAchievements = '/api/progress/achievements';
  static const String progressWeeklyReport = '/api/progress/weekly-report';
  static const String progressHeatmap = '/api/progress/heatmap';
  static const String vocabulary = '/api/vocabulary';
  static const String notificationSettings = '/api/notifications/settings';
  static const String notificationLogs = '/api/notifications/logs';
  static const String subscriptionMe = '/api/subscriptions/me';
  static const String subscriptionVerify = '/api/subscriptions/verify';
}
