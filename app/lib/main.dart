import 'dart:convert';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kakao_flutter_sdk_user/kakao_flutter_sdk_user.dart';
import 'core/constants/app_constants.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_mode_provider.dart';
import 'core/router/app_router.dart';
import 'core/widget/home_widget_service.dart';
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
  bool _pushInitialized = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Only auto-init push for returning users who already finished
    // onboarding. First-run users opt in explicitly on the onboarding
    // screen, so the system permission dialog is preceded by context.
    ref.listenManual(authStateProvider, (previous, next) {
      _maybeInitPush(next.asData?.value != null);
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

  void _maybeInitPush(bool isLoggedIn) {
    if (_pushInitialized) return;
    if (isLoggedIn && ref.read(onboardingSeenProvider)) {
      _pushInitialized = true;
      ref.read(pushServiceProvider).initialize();
    }
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
        return DecoratedBox(
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
        );
      },
    );
  }
}
