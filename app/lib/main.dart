import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kakao_flutter_sdk_user/kakao_flutter_sdk_user.dart';
import 'core/constants/app_constants.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';
import 'features/auth/domain/auth_provider.dart';
import 'features/notification/data/push_service.dart';
import 'features/onboarding/domain/onboarding_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase init — will fail gracefully if not configured
  try {
    await Firebase.initializeApp();
  } catch (e) {
    debugPrint('Firebase init skipped: $e');
  }

  if (AppConstants.kakaoNativeAppKey.isNotEmpty) {
    KakaoSdk.init(nativeAppKey: AppConstants.kakaoNativeAppKey);
  }

  final prefs = await SharedPreferences.getInstance();
  final seenOnboarding = prefs.getBool(onboardingSeenKey) ?? false;

  runApp(
    ProviderScope(
      overrides: [
        onboardingSeenProvider.overrideWith(
          () => OnboardingNotifier(seenOnboarding),
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

class _LingoLoopAppState extends ConsumerState<LingoLoopApp> {
  bool _pushInitialized = false;

  @override
  void initState() {
    super.initState();
    // Only auto-init push for returning users who already finished
    // onboarding. First-run users opt in explicitly on the onboarding
    // screen, so the system permission dialog is preceded by context.
    ref.listenManual(authStateProvider, (previous, next) {
      _maybeInitPush(next.asData?.value != null);
    });
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

    return MaterialApp.router(
      title: 'LingoLoop',
      theme: AppTheme.light,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
      // Every screen uses a transparent Scaffold; paint the warm gradient
      // once behind the whole app so pushed (non-shell) routes like the
      // history / notification-settings pages never fall back to black.
      builder: (context, child) => DecoratedBox(
        decoration: const BoxDecoration(
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
  }
}
