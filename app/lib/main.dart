import 'dart:convert';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kakao_flutter_sdk_user/kakao_flutter_sdk_user.dart';
import 'core/constants/app_constants.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_mode_provider.dart';
import 'core/router/app_router.dart';
import 'core/widget/home_widget_service.dart';
import 'core/ads/att_service.dart';
import 'features/auth/domain/auth_model.dart';
import 'features/auth/domain/auth_provider.dart';
import 'features/notification/data/push_service.dart';
import 'features/onboarding/domain/onboarding_provider.dart';
import 'features/sentence/domain/sentence_provider.dart';
import 'features/vocabulary/domain/vocabulary_provider.dart';

/// Background isolate entry point for FCM data-only messages.
///
/// Triggered by the server's daily silent push (`type=widget_refresh`):
/// receives the new day's sentence in the payload and writes it straight
/// into the App Group so the home screen widget can render today's
/// content without waiting for the user to open the app.
///
/// Must be top-level + `@pragma('vm:entry-point')` because Flutter spins
/// up a fresh isolate for background messages and can only locate handlers
/// that survive tree-shaking.
@pragma('vm:entry-point')
Future<void> _firebaseBgHandler(RemoteMessage message) async {
  DartPluginRegistrant.ensureInitialized();
  try {
    await Firebase.initializeApp();
  } catch (_) {}

  if (message.data['type'] != 'widget_refresh') return;

  final d = message.data;
  await HomeWidgetService.updateTodaySentence(
    text: d['today_text'] ?? '',
    translation: d['today_translation'] ?? '',
    assignedDate: d['today_date'] ?? '',
    pronunciation: d['today_pronunciation'],
    situation: d['today_situation'],
    words: _parseWordsFromPayload(d['today_words']),
  );
}

/// Decodes a `today_words` payload (JSON string of `[{w,m}, ...]`) into
/// the typed tuple list accepted by `HomeWidgetService`. Tolerates a
/// missing key, malformed JSON, or unexpected shapes silently — the
/// background handler never throws.
List<({String word, String meaning})> _parseWordsFromPayload(dynamic raw) {
  if (raw == null) return const [];
  final s = raw.toString();
  if (s.isEmpty) return const [];
  try {
    final decoded = jsonDecode(s);
    if (decoded is! List) return const [];
    return [
      for (final item in decoded)
        if (item is Map)
          (
            word: (item['w'] ?? '').toString(),
            meaning: (item['m'] ?? '').toString(),
          ),
    ];
  } catch (_) {
    return const [];
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase init — will fail gracefully if not configured
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseBgHandler);
  } catch (e) {
    debugPrint('Firebase init skipped: $e');
  }

  if (AppConstants.kakaoNativeAppKey.isNotEmpty) {
    KakaoSdk.init(nativeAppKey: AppConstants.kakaoNativeAppKey);
  }

  // AdMob SDK init — banner load 전 한 번 호출 필요. iOS는 app id /
  // SKAdNetworkItems가 Info.plist에 있어야 SDK가 안전하게 시작.
  // 실패는 swallow — Ads 없어도 앱 동작은 정상.
  try {
    await MobileAds.instance.initialize();
  } catch (e) {
    debugPrint('MobileAds init skipped: $e');
  }

  final prefs = await SharedPreferences.getInstance();
  final seenOnboarding = prefs.getBool(onboardingSeenKey) ?? false;
  final themeMode = themeModeFromString(prefs.getString(themeModeKey));

  runApp(
    ProviderScope(
      overrides: [
        onboardingSeenProvider.overrideWith(
          () => OnboardingNotifier(seenOnboarding),
        ),
        themeModeProvider.overrideWith(
          () => ThemeModeNotifier(themeMode),
        ),
      ],
      child: const LingoLoopApp(),
    ),
  );
}

class LingoLoopApp extends ConsumerStatefulWidget {
  const LingoLoopApp({super.key});

  @override
  ConsumerState<LingoLoopApp> createState() => _LingoLoopAppState();
}

class _LingoLoopAppState extends ConsumerState<LingoLoopApp>
    with WidgetsBindingObserver {
  /// 마지막으로 push init을 마친 사용자 id. 단순 bool 플래그였다가
  /// "로그아웃 → 다른 계정 로그인" 시 두 번째 사용자에 토큰이 등록
  /// 안 되는 버그가 있었음 — 옛 user 토큰이 그대로 활성이라 푸시가
  /// 잘못된 계정으로 감. 사용자 id 변경을 감지해 PushService.reset()
  /// 후 재초기화.
  String? _pushInitializedForUserId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Only auto-init push for returning users who already finished
    // onboarding. First-run users opt in explicitly on the onboarding
    // screen, so the system permission dialog is preceded by context.
    ref.listenManual(authStateProvider, (previous, next) {
      _maybeInitPush(next.asData?.value);
    });
    // App-level ATT 한 번. iOS 14+ AdMob 개인화 광고용 IDFA 권한.
    // onboarding _finish에서 호출하던 걸 여기로 이동 — onboardingSeen
    // =true인 기존 사용자는 onboarding 안 들러서 영원히 안 묻혔던
    // 버그 해결. AttService 자체가 idempotent라 매 launch마다 호출해도
    // 두 번째 부터는 OS 캐시 결과만 반환 (다이얼로그 안 뜸).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      AttService.requestIfNeeded();
      // cold launch 시 뱃지 reset — push 받은 상태로 앱 종료 후 다시
      // 열 때 lifecycle.resumed 가 즉시 fire 안 되는 경우 대비.
      ref.read(pushServiceProvider).clearIosBadge();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // When the app leaves the foreground, push the freshest cached
    // sentence + vocabulary into the App Group so the home screen widget
    // does not lag behind data the user already saw in-app.
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden ||
        state == AppLifecycleState.inactive) {
      _pushWidgetSnapshot();
    }
    // foreground 진입 시 iOS 앱 아이콘 뱃지 reset — 서버 push가
    // badge=1로 set하면 OS가 자동으로 0으로 안 떨어뜨려 사용자가 앱
    // 열어도 1 고정으로 남는 문제 해결.
    if (state == AppLifecycleState.resumed) {
      ref.read(pushServiceProvider).clearIosBadge();
    }
  }

  void _pushWidgetSnapshot() {
    final today = ref.read(todaySentenceProvider).asData?.value;
    if (today != null) {
      HomeWidgetService.updateTodaySentence(
        text: today.sentence.text,
        translation: today.sentence.translation,
        assignedDate: today.assignedDate,
        pronunciation: today.sentence.pronunciation,
        situation: today.sentence.situation,
        words: [
          for (final w in today.sentence.words)
            (word: w.word, meaning: w.meaning),
        ],
      );
    }
    final vocab = ref.read(vocabularyListProvider).asData?.value;
    if (vocab != null) {
      HomeWidgetService.updateVocabulary([
        for (final v in vocab.items)
          (
            word: v.word,
            meaning: v.meaning ?? '',
            sentence: v.sentenceText ?? '',
            translation: v.sentenceTranslation ?? '',
          ),
      ]);
    }
    // Even if neither provider has data, tell the widget to redraw — the
    // native side may switch to/from the "stale" message based on date.
    HomeWidgetService.refreshOnly();
  }

  void _maybeInitPush(UserInfo? user) {
    // 로그아웃 — push service의 init 가드를 풀어, 다음 사용자가
    // 들어왔을 때 새 토큰 등록이 다시 일어나게.
    if (user == null) {
      if (_pushInitializedForUserId != null) {
        ref.read(pushServiceProvider).reset();
        _pushInitializedForUserId = null;
      }
      return;
    }
    // 동일 사용자 — 이미 init. tier/track 변경 등으로 listener가 또
    // 호출돼도 push 재초기화 불필요.
    if (_pushInitializedForUserId == user.id) return;
    if (!ref.read(onboardingSeenProvider)) return;

    // 사용자 전환 (A → B) — 옛 init 풀고 새 사용자로 토큰 register.
    if (_pushInitializedForUserId != null) {
      ref.read(pushServiceProvider).reset();
    }
    _pushInitializedForUserId = user.id;
    ref.read(pushServiceProvider).initialize();
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(
      title: 'LingoLoop',
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeMode,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
      // Sync the AppColors palette to the resolved brightness, then paint
      // the gradient behind every (transparent) Scaffold so pushed routes
      // never fall back to a bare/black background.
      builder: (context, child) {
        AppColors.applyBrightness(Theme.of(context).brightness);
        return GestureDetector(
          // Tap on empty area anywhere in the app → dismiss keyboard.
          // `translucent` is required because the default deferToChild
          // mode wouldn't fire on transparent backgrounds. TextFields /
          // Buttons still win the gesture arena for taps on themselves,
          // so this only catches "between widget" taps. Scroll/swipe
          // gestures are unaffected since this only listens to onTap.
          behavior: HitTestBehavior.translucent,
          onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  AppColors.gradientStart,
                  AppColors.background,
                  AppColors.gradientEnd,
                ],
              ),
            ),
            child: child,
          ),
        );
      },
    );
  }
}
