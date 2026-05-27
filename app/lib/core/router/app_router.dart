import 'package:flutter/foundation.dart';
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
import '../../features/subscription/presentation/subscription_help_screen.dart';
import '../../features/support/presentation/inquiry_list_screen.dart';
import '../../features/subscription/presentation/subscription_screen.dart';
import '../../features/vocabulary/presentation/vocabulary_screen.dart';
import '../../features/review/presentation/review_hub_screen.dart';
import '../../features/review/presentation/review_screen.dart';
import '../../features/onboarding/presentation/onboarding_screen.dart';
import '../../features/onboarding/domain/onboarding_provider.dart';
import '../../features/track/presentation/track_select_screen.dart';
import '../../features/auth/domain/auth_provider.dart';
import '../analytics/analytics_service.dart';

/// Ticks once for every relevant state change. GoRouter listens to
/// this and re-runs its `redirect` callback in place instead of
/// rebuilding the whole `MaterialApp.router` widget tree.
///
/// Previously `routerProvider` itself called `ref.watch(authState)`
/// — every auth transition (AsyncLoading → AsyncData) constructed a
/// NEW GoRouter, MaterialApp.router swapped routerConfig, and the
/// entire screen tree (including the LoginScreen mid-`await login()`)
/// got disposed. The SnackBar fired against a no-longer-mounted
/// context and silently dropped.
final _routerRefreshProvider = Provider<ValueNotifier<int>>((ref) {
  final notifier = ValueNotifier<int>(0);
  ref.listen(authStateProvider, (_, _) => notifier.value++);
  ref.listen(onboardingSeenProvider, (_, _) => notifier.value++);
  ref.onDispose(notifier.dispose);
  return notifier;
});

final routerProvider = Provider<GoRouter>((ref) {
  // Keep the GoRouter instance stable for the life of the provider
  // scope. State changes flow through `refreshListenable`, not a
  // fresh router object.
  final refresh = ref.read(_routerRefreshProvider);
  final analyticsObserver = ref.read(analyticsObserverProvider);

  return GoRouter(
    initialLocation: '/',
    observers: [?analyticsObserver],
    refreshListenable: refresh,
    redirect: (context, state) {
      // Re-read auth + onboarding state every time the redirect runs;
      // `refreshListenable` fires this whenever they change.
      final authState = ref.read(authStateProvider);
      final onboardingSeen = ref.read(onboardingSeenProvider);
      final hasTrack = authState.value?.learningTrack != null;
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
        pageBuilder: (c, s) => const NoTransitionPage(child: ReviewScreen()),
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
        path: '/subscription/help',
        pageBuilder: (c, s) =>
            const NoTransitionPage(child: SubscriptionHelpScreen()),
      ),
      GoRoute(
        path: '/inquiries',
        pageBuilder: (c, s) =>
            const NoTransitionPage(child: InquiryListScreen()),
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
        pageBuilder: (c, s) => const NoTransitionPage(child: RegisterScreen()),
      ),
      GoRoute(
        path: '/history',
        pageBuilder: (c, s) => const NoTransitionPage(child: HistoryScreen()),
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
