import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';
import 'features/auth/domain/auth_provider.dart';
import 'features/notification/data/push_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase init — will fail gracefully if not configured
  try {
    await Firebase.initializeApp();
  } catch (e) {
    debugPrint('Firebase init skipped: $e');
  }

  runApp(const ProviderScope(child: LingoLoopApp()));
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
    ref.listenManual(authStateProvider, (_, next) {
      final user = next.asData?.value;
      if (user != null && !_pushInitialized) {
        _initializePush();
      }
    });
  }

  Future<void> _initializePush() async {
    _pushInitialized = true;
    await ref.read(pushServiceProvider).initialize();
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'LingoLoop',
      theme: AppTheme.light,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
