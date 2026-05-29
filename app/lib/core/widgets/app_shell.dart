import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_colors.dart';
import '../theme/theme_mode_provider.dart';
import '../../features/review/domain/review_provider.dart';
import '../../features/subscription/data/subscription_repository.dart';
import '../../features/subscription/domain/subscription_provider.dart';

class AppShell extends ConsumerStatefulWidget {
  final String location;
  final Widget child;

  const AppShell({super.key, required this.location, required this.child});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  DateTime? _lastBackPressedAt;

  bool get _isAndroid => !kIsWeb && Platform.isAndroid;

  /// `true`를 반환하면 시스템 back을 소비(앱 종료 막음), `false`면
  /// 다음 핸들러로 전파. BackButtonListener는 Router.backButtonDispatcher
  /// 위에 ChildBackButtonDispatcher를 takePriority로 얹어, GoRouter의
  /// routerDelegate.popRoute보다 먼저 호출됨 — ShellRoute 안쪽 navigator를
  /// 거치지 않으므로 홈탭처럼 pop할 게 없는 위치에서도 정상 동작.
  Future<bool> _onBackPressed() async {
    if (!_isAndroid) return false;
    final isHomeTab = _indexForLocation(widget.location) == 0;
    if (!isHomeTab) {
      _goToTab(context, 0);
      return true;
    }
    final now = DateTime.now();
    if (_lastBackPressedAt != null &&
        now.difference(_lastBackPressedAt!) < const Duration(seconds: 2)) {
      // 2초 내 두 번째 back — 실제 종료. SystemNavigator.pop으로 명시
      // 종료. (false를 반환해도 OS가 종료시키지만, 명시가 의도 더 분명.)
      SystemNavigator.pop();
      return true;
    }
    _lastBackPressedAt = now;
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.hideCurrentSnackBar();
    messenger?.showSnackBar(
      const SnackBar(
        content: Text('한 번 더 뒤로가기를 하면 종료됩니다.'),
        duration: Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
    return true;
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(themeModeProvider);

    ref.listen<AsyncValue<SubscriptionStatus>>(
      subscriptionStatusProvider,
      (prev, next) {
        final prevPremium = prev?.value?.isPremium ?? false;
        final nextPremium = next.value?.isPremium ?? false;
        if (prevPremium != nextPremium) {
          ref.invalidate(reviewQueueProvider);
        }
      },
    );

    final currentIndex = _indexForLocation(widget.location);

    final scaffold = Scaffold(
      extendBody: true,
      backgroundColor: Colors.transparent,
      body: widget.child,
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: AppColors.cardBorder),
            boxShadow: [
              BoxShadow(
                color: AppColors.softShadow,
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(30),
            child: NavigationBar(
              selectedIndex: currentIndex,
              onDestinationSelected: (index) => _goToTab(context, index),
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.wb_sunny_outlined),
                  selectedIcon: Icon(Icons.wb_sunny),
                  label: '오늘',
                ),
                NavigationDestination(
                  icon: Icon(Icons.replay_outlined),
                  selectedIcon: Icon(Icons.replay),
                  label: '복습',
                ),
                NavigationDestination(
                  icon: Icon(Icons.insights_outlined),
                  selectedIcon: Icon(Icons.insights),
                  label: '기록',
                ),
                NavigationDestination(
                  icon: Icon(Icons.settings_outlined),
                  selectedIcon: Icon(Icons.settings),
                  label: '설정',
                ),
              ],
            ),
          ),
        ),
      ),
    );

    if (!_isAndroid) return scaffold;
    return BackButtonListener(
      onBackButtonPressed: _onBackPressed,
      child: scaffold,
    );
  }

  int _indexForLocation(String location) {
    if (location.startsWith('/review')) return 1;
    if (location.startsWith('/progress')) return 2;
    if (location.startsWith('/settings')) return 3;
    return 0;
  }

  void _goToTab(BuildContext context, int index) {
    final root = Navigator.of(context, rootNavigator: true);
    root.popUntil((route) => route is! PopupRoute);

    switch (index) {
      case 0:
        context.go('/');
        return;
      case 1:
        context.go('/review');
        return;
      case 2:
        context.go('/progress');
        return;
      case 3:
        context.go('/settings');
        return;
    }
  }
}
