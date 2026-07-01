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
import '../../features/quiz/presentation/sentence_review_quiz_screen.dart';
import '../../features/quiz/presentation/quiz_history_screen.dart';
import '../../features/progress/presentation/progress_screen.dart';
import '../../features/progress/presentation/sentence_progress_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../../features/subscription/presentation/subscription_help_screen.dart';
import '../../features/settings/presentation/business_info_screen.dart';
import '../../features/support/presentation/inquiry_list_screen.dart';
import '../../features/subscription/presentation/subscription_screen.dart';
import '../../features/vocabulary/presentation/vocabulary_screen.dart';
import '../../features/review/presentation/review_hub_screen.dart';
import '../../features/review/presentation/review_screen.dart';
import '../../features/onboarding/presentation/onboarding_screen.dart';
import '../../features/onboarding/domain/onboarding_provider.dart';
import '../../features/track/presentation/track_select_screen.dart';
import '../../features/language/presentation/language_select_screen.dart';
import '../../features/language/domain/language_selected_provider.dart';
import '../../features/language/domain/language_tracks_provider.dart';
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
  // 다언어 — stored track 목록이 바뀌면 가드 재평가. 신규 사용자가 첫
  // 학습 언어를 고르면 (빈 목록 → 1개)로 바뀌어 /language 가드가 해제됨.
  ref.listen(languageTracksProvider, (_, _) => notifier.value++);
  // 트랙은 아직 못 골랐지만 언어는 명시 선택한 상태도 hasAnyLang으로
  // 인식해야 /track으로 진입 가능 (서버는 트랙 row가 있어야만 row를
  // 만들어 listLanguageTracks가 빈 배열을 반환하는 윈도우 보강).
  ref.listen(languageSelectedProvider, (_, _) => notifier.value++);
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
      // 콜드 스타트 첫 ~50ms — AuthNotifier.build()가 secure storage에서
      // 캐시된 user를 읽는 중. 이 윈도우 동안 redirect가 /login으로
      // 보내면 로그인 화면이 깜빡임. 로딩 끝나면 refreshListenable이
      // 다시 redirect를 호출해 정상 경로로 보냄.
      if (authState.isLoading && authState.value == null) return null;
      final hasTrack = authState.value?.learningTrack != null;
      final isLoggedIn = authState.value != null;
      final loc = state.matchedLocation;
      final isAuthRoute = loc == '/login' || loc == '/register';

      if (!isLoggedIn) {
        return isAuthRoute ? null : '/login';
      }

      // 다언어 — 사용자가 한 번이라도 학습 언어를 선택했는지. 트랙이 있는
      // 사용자(기존 1.1.x 사용자 포함, backfill로 row 존재)는 true.
      final tracksAsync = ref.read(languageTracksProvider);
      // 가드 의도: track 없는 경우만 검사. 트랙 이미 있으면 언어도 이미
      // 선택된 상태(트랙 저장 시 항상 짝).
      final hasAnyLang = hasTrack ||
          hasAnyLanguageTrack(tracksAsync) ||
          ref.read(languageSelectedProvider);
      // 로딩 중일 땐 신중히 — 아직 결정 못 하면 현재 위치 유지(메인탭
      // 깜빡임 방지). 결과가 들어오면 refreshListenable이 재호출.
      if (!hasTrack && tracksAsync.isLoading && tracksAsync.value == null) {
        // 트랙도 없고 언어 트랙 목록도 미수신 — 잠시 후 결정.
        return null;
      }

      // 로그인 사용자의 "지금 있어야 할 곳" 한 번에 계산. 단계별 redirect
      // (예: /register → / → /onboarding)로 끊으면 중간 페이지가 한 프레임
      // 빌드돼 메인탭이 깜빡임. 모든 분기를 합쳐 단일 redirect로.
      final String target;
      if (!onboardingSeen) {
        target = '/onboarding';
      } else if (!hasAnyLang) {
        // 학습 언어 한 번도 안 골랐음 — 언어 선택부터.
        target = '/language';
      } else if (!hasTrack) {
        target = '/track';
      } else {
        // /onboarding은 일회성 게이트 — 이미 본 사용자가 그 자리에 있으면
        // 홈으로. /language, /track은 설정에서 변경 목적으로 의도적으로
        // 들어가는 화면이라 머물게 둠. 그 외 메인 탭/상세도 유지.
        target = (isAuthRoute || loc == '/onboarding') ? '/' : loc;
      }
      return target == loc ? null : target;
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
        path: '/sentence-review/:sentenceId',
        pageBuilder: (c, s) {
          final id = int.tryParse(s.pathParameters['sentenceId'] ?? '') ?? 0;
          return NoTransitionPage(
            child: SentenceReviewQuizScreen(sentenceId: id),
          );
        },
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
        path: '/business-info',
        pageBuilder: (c, s) =>
            const NoTransitionPage(child: BusinessInfoScreen()),
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
        path: '/language',
        pageBuilder: (c, s) {
          // 온보딩 흐름 / 설정에서 들어온 경우 구분 — extra=true면 온보딩.
          final fromOnboarding = (s.extra as bool?) ?? false;
          return NoTransitionPage(
            child: LanguageSelectScreen(fromOnboarding: fromOnboarding),
          );
        },
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
