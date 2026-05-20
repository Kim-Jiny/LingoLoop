import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../widgets/app_shell.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/sentence/presentation/today_screen.dart';
import '../../features/sentence/presentation/history_screen.dart';
import '../../features/sentence/presentation/search_screen.dart';
import '../../features/notification/presentation/notification_settings_screen.dart';
import '../../features/quiz/presentation/quiz_screen.dart';
import '../../features/quiz/presentation/quiz_history_screen.dart';
import '../../features/progress/presentation/progress_screen.dart';
import '../../features/progress/presentation/sentence_progress_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../../features/subscription/presentation/subscription_screen.dart';
import '../../features/vocabulary/presentation/vocabulary_screen.dart';
import '../../features/review/presentation/review_hub_screen.dart';
import '../../features/review/presentation/review_screen.dart';
import '../../features/onboarding/presentation/onboarding_screen.dart';
import '../../features/onboarding/domain/onboarding_provider.dart';
import '../../features/track/presentation/track_select_screen.dart';
import '../../features/auth/domain/auth_provider.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);
  final onboardingSeen = ref.watch(onboardingSeenProvider);
  final hasTrack = authState.value?.learningTrack != null;

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final isLoggedIn = authState.value != null;
      final loc = state.matchedLocation;
      final isAuthRoute = loc == '/login' || loc == '/register';

      if (!isLoggedIn && !isAuthRoute) return '/login';
      if (isLoggedIn && isAuthRoute) return '/';
      if (isLoggedIn && !onboardingSeen && loc != '/onboarding') {
        return '/onboarding';
      }
      if (isLoggedIn && onboardingSeen && loc == '/onboarding') return '/';
      // After onboarding, force the track survey until a plan is chosen.
      if (isLoggedIn &&
          onboardingSeen &&
          !hasTrack &&
          loc != '/track' &&
          loc != '/onboarding') {
        return '/track';
      }
      return null;
    },
    routes: [
      ShellRoute(
        builder: (context, state, child) =>
            AppShell(location: state.matchedLocation, child: child),
        routes: [
          // Tab switches use NoTransitionPage: instant swap, no slide.
          // (iOS Cupertino slide over transparent Scaffolds left the
          // previous tab visible underneath.)
          GoRoute(
            path: '/',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: TodayScreen()),
          ),
          GoRoute(
            path: '/review',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: ReviewHubScreen()),
          ),
          GoRoute(
            path: '/progress',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: ProgressScreen()),
          ),
          GoRoute(
            path: '/settings',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: SettingsScreen()),
          ),
        ],
      ),
      GoRoute(
        path: '/review/session',
        pageBuilder: (c, s) =>
            const NoTransitionPage(child: ReviewScreen()),
      ),
      GoRoute(
        path: '/quiz',
        pageBuilder: (c, s) => const NoTransitionPage(child: QuizScreen()),
      ),
      GoRoute(
        path: '/notification-settings',
        pageBuilder: (c, s) =>
            const NoTransitionPage(child: NotificationSettingsScreen()),
      ),
      GoRoute(
        path: '/subscription',
        pageBuilder: (c, s) =>
            const NoTransitionPage(child: SubscriptionScreen()),
      ),
      GoRoute(
        path: '/vocabulary',
        pageBuilder: (c, s) =>
            const NoTransitionPage(child: VocabularyScreen()),
      ),
      GoRoute(
        path: '/onboarding',
        pageBuilder: (c, s) =>
            const NoTransitionPage(child: OnboardingScreen()),
      ),
      GoRoute(
        path: '/track',
        pageBuilder: (c, s) =>
            const NoTransitionPage(child: TrackSelectScreen()),
      ),
      GoRoute(
        path: '/login',
        pageBuilder: (c, s) => const NoTransitionPage(child: LoginScreen()),
      ),
      GoRoute(
        path: '/register',
        pageBuilder: (c, s) =>
            const NoTransitionPage(child: RegisterScreen()),
      ),
      GoRoute(
        path: '/history',
        pageBuilder: (c, s) =>
            const NoTransitionPage(child: HistoryScreen()),
      ),
      GoRoute(
        path: '/search',
        pageBuilder: (c, s) =>
            const NoTransitionPage(child: SentenceSearchScreen()),
      ),
      GoRoute(
        path: '/quiz-history',
        pageBuilder: (c, s) =>
            const NoTransitionPage(child: QuizHistoryScreen()),
      ),
      GoRoute(
        path: '/sentence-progress',
        pageBuilder: (c, s) =>
            const NoTransitionPage(child: SentenceProgressScreen()),
      ),
    ],
  );
});
