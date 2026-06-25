import 'dart:convert';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kakao_flutter_sdk_user/kakao_flutter_sdk_user.dart';
import 'core/constants/app_constants.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_mode_provider.dart';
import 'core/router/android_back_button_dispatcher.dart';
import 'core/router/app_router.dart';
import 'core/widget/home_widget_service.dart';
import 'core/ads/att_service.dart';
import 'features/auth/domain/auth_model.dart';
import 'features/auth/domain/auth_provider.dart';
import 'features/notification/data/push_service.dart';
import 'features/language/domain/language_selected_provider.dart';
import 'features/onboarding/domain/onboarding_provider.dart';
import 'features/sentence/domain/sentence_provider.dart';
import 'features/subscription/data/purchase_service.dart';
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
  final binding = WidgetsFlutterBinding.ensureInitialized();
  // 네이티브 스플래시 유지 — Flutter 엔진이 준비돼도 자동 제거되지 않게
  // 잡아두고, runApp 후 2초 뒤 명시 remove. main()의 비동기 init이
  // 길어지면 그만큼 스플래시도 길어짐 — 사용자에겐 부팅이 매끄러워 보임.
  FlutterNativeSplash.preserve(widgetsBinding: binding);

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
  final languageSelected = prefs.getBool(languageSelectedKey) ?? false;
  final themeMode = themeModeFromString(prefs.getString(themeModeKey));

  runApp(
    ProviderScope(
      overrides: [
        onboardingSeenProvider.overrideWith(
          () => OnboardingNotifier(seenOnboarding),
        ),
        languageSelectedProvider.overrideWith(
          () => LanguageSelectedNotifier(languageSelected),
        ),
        themeModeProvider.overrideWith(() => ThemeModeNotifier(themeMode)),
      ],
      child: const LingoLoopApp(),
    ),
  );

  // 정확히 2초 뒤 네이티브 스플래시 제거. main()의 비동기 init이 2초보다
  // 길었다면 이 호출 시점은 이미 그 시점이 지난 직후이므로 즉시 제거됨.
  Future.delayed(const Duration(seconds: 2), FlutterNativeSplash.remove);
}

class LingoLoopApp extends ConsumerStatefulWidget {
  const LingoLoopApp({super.key});

  @override
  ConsumerState<LingoLoopApp> createState() => _LingoLoopAppState();
}

class _LingoLoopAppState extends ConsumerState<LingoLoopApp>
    with WidgetsBindingObserver {
  static const _nativeBackChannel = MethodChannel('com.jiny.lingoloop/back');

  late final _scaffoldMessengerKey = GlobalObjectKey<ScaffoldMessengerState>(
    this,
  );
  AndroidBackButtonDispatcher? _backButtonDispatcher;
  GoRouter? _backButtonDispatcherRouter;

  /// 마지막으로 push init을 마친 사용자 id. 단순 bool 플래그였다가
  /// "로그아웃 → 다른 계정 로그인" 시 두 번째 사용자에 토큰이 등록
  /// 안 되는 버그가 있었음 — 옛 user 토큰이 그대로 활성이라 푸시가
  /// 잘못된 계정으로 감. 사용자 id 변경을 감지해 PushService.reset()
  /// 후 재초기화.
  String? _pushInitializedForUserId;

  /// 마지막으로 silent restore를 돌린 사용자 id. 로그인/cold launch
  /// 시 한 번만 Apple/Google에 재확인해 서버 stale 상태를 풀어줌.
  /// 사용자 전환 시 재실행되도록 같은 가드 패턴.
  String? _subscriptionRestoredForUserId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _nativeBackChannel.setMethodCallHandler(_handleNativeBackCall);
    // Only auto-init push for returning users who already finished
    // onboarding. First-run users opt in explicitly on the onboarding
    // screen, so the system permission dialog is preceded by context.
    ref.listenManual(authStateProvider, (previous, next) {
      final user = next.asData?.value;
      _maybeInitPush(user);
      _maybeRefreshSubscription(user);
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
    _nativeBackChannel.setMethodCallHandler(null);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<dynamic> _handleNativeBackCall(MethodCall call) async {
    if (call.method != 'handleBackPressed') return false;
    return _backButtonDispatcher?.didPopRoute() ?? false;
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
            status: v.status,
          ),
      ]);
    }
    // Even if neither provider has data, tell the widget to redraw — the
    // native side may switch to/from the "stale" message based on date.
    HomeWidgetService.refreshOnly();
  }

  /// 로그인 / cold launch 시 구독 상태를 Apple/Google에 재확인. 서버
  /// 만 invalidate해도 서버 자체가 stale일 수 있어 사용자가 매번 구독
  /// 화면의 "구매 복원"을 눌러야 풀리는 문제가 있었음. silent restore
  /// 로 자동 처리 — PurchaseService가 verify 성공 시 subscriptionStatus
  /// Provider를 invalidate하도록 이미 wired up되어 있어 별도 callback
  /// 불필요.
  ///
  /// 사용자당 한 번만 (per session) — 매 listener fire마다 호출하면
  /// StoreKit/Play API에 불필요한 부하.
  void _maybeRefreshSubscription(UserInfo? user) {
    if (user == null) {
      _subscriptionRestoredForUserId = null;
      return;
    }
    if (_subscriptionRestoredForUserId == user.id) return;
    _subscriptionRestoredForUserId = user.id;
    // 실패해도 학습 흐름엔 영향 없으므로 silent. fire-and-forget.
    ref
        .read(purchaseServiceProvider)
        .restorePurchases(onSynced: () async {})
        .catchError((_) {});
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
    if (_backButtonDispatcherRouter != router) {
      _backButtonDispatcherRouter = router;
      _backButtonDispatcher = AndroidBackButtonDispatcher(
        router: router,
        scaffoldMessengerKey: _scaffoldMessengerKey,
      );
    }

    return MaterialApp.router(
      title: 'LingoLoop',
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeMode,
      scaffoldMessengerKey: _scaffoldMessengerKey,
      routeInformationProvider: router.routeInformationProvider,
      routeInformationParser: router.routeInformationParser,
      routerDelegate: router.routerDelegate,
      backButtonDispatcher: _backButtonDispatcher,
      debugShowCheckedModeBanner: false,
      // Sync the AppColors palette to the resolved brightness, then paint
      // the gradient behind every (transparent) Scaffold so pushed routes
      // never fall back to a bare/black background.
      builder: (context, child) {
        final brightness = Theme.of(context).brightness;
        AppColors.applyBrightness(brightness);
        // 라이트 테마: 배경이 밝은 크림색이라 상태바 아이콘이 흰색이면
        // 안 보임. 다크 테마는 반대.
        // iOS는 AppBar AnnotatedRegion에서 picking이 누락되는 경우가
        // 있어 SystemChrome으로 직접 강제 set — frame 단위로 갱신되어
        // 신뢰성 높음. AnnotatedRegion은 Android backup 겸 보조.
        final overlay = brightness == Brightness.light
            ? const SystemUiOverlayStyle(
                statusBarColor: Colors.transparent,
                statusBarBrightness:
                    Brightness.light, // iOS: bg=light → dark icons
                statusBarIconBrightness: Brightness.dark, // Android: dark icons
                systemNavigationBarIconBrightness: Brightness.dark,
              )
            : const SystemUiOverlayStyle(
                statusBarColor: Colors.transparent,
                statusBarBrightness: Brightness.dark,
                statusBarIconBrightness: Brightness.light,
                systemNavigationBarIconBrightness: Brightness.light,
              );
        SystemChrome.setSystemUIOverlayStyle(overlay);
        return AnnotatedRegion<SystemUiOverlayStyle>(
          value: overlay,
          child: GestureDetector(
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
          ),
        );
      },
    );
  }
}
