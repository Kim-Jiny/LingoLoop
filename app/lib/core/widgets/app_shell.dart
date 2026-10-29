import 'package:flutter/material.dart';
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
  /// 아래로 스크롤하는 동안 true — 탭바를 화면 밖으로 밀어 콘텐츠를 넓게 쓴다.
  bool _hidden = false;

  @override
  void didUpdateWidget(AppShell old) {
    super.didUpdateWidget(old);
    // 탭을 옮기면 항상 다시 보이게.
    if (old.location != widget.location) {
      _hidden = false;
      _scrolled = 0;
    }
  }

  /// 방향이 바뀐 뒤 누적된 스크롤 거리(+아래로, -위로). 살짝 스쳐도 탭바가
  /// 깜빡이지 않도록 일정 거리 이상일 때만 숨김/표시를 바꾼다.
  double _scrolled = 0;

  static const _hideAfter = 120.0;
  static const _showAfter = 40.0;

  bool _onScroll(ScrollUpdateNotification n) {
    // 가장 바깥 세로 스크롤만 본다 (가로 TabBarView, 안쪽 리스트는 무시).
    if (n.depth != 0 || n.metrics.axis != Axis.vertical) return false;
    final m = n.metrics;
    // 맨 위에서는 항상 보인다. 오버스크롤(iOS 바운스)은 무시.
    if (m.pixels <= m.minScrollExtent + 1) {
      _scrolled = 0;
      if (_hidden) setState(() => _hidden = false);
      return false;
    }
    if (m.outOfRange) return false;

    final delta = n.scrollDelta ?? 0;
    // 방향이 바뀌면 누적을 새로 시작.
    if (delta != 0 && (delta > 0) != (_scrolled > 0)) _scrolled = 0;
    _scrolled += delta;

    if (!_hidden && _scrolled > _hideAfter) {
      setState(() => _hidden = true);
    } else if (_hidden && _scrolled < -_showAfter) {
      setState(() => _hidden = false);
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(themeModeProvider);

    ref.listen<AsyncValue<SubscriptionStatus>>(subscriptionStatusProvider, (
      prev,
      next,
    ) {
      final prevPremium = prev?.value?.isPremium ?? false;
      final nextPremium = next.value?.isPremium ?? false;
      if (prevPremium != nextPremium) {
        ref.invalidate(reviewQueueProvider);
      }
    });

    final currentIndex = _indexForLocation(widget.location);

    return Scaffold(
      extendBody: true,
      backgroundColor: Colors.transparent,
      body: NotificationListener<ScrollUpdateNotification>(
        onNotification: _onScroll,
        child: widget.child,
      ),
      bottomNavigationBar: AnimatedSlide(
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOutCubic,
        offset: _hidden ? const Offset(0, 1.6) : Offset.zero,
        child: IgnorePointer(
          ignoring: _hidden,
          child: SafeArea(
            minimum: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: DecoratedBox(
              // CartoonCard와 같은 윤곽선 + 어긋난 단색 그림자.
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(30),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.textPrimary.withValues(alpha: 0.85),
                    offset: const Offset(0, 4),
                    blurRadius: 0,
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(30),
                child: DecoratedBox(
                  position: DecorationPosition.foreground,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(30),
                    border: Border.all(
                      color: AppColors.textPrimary.withValues(alpha: 0.85),
                      width: 2,
                    ),
                  ),
                  child: NavigationBar(
                    backgroundColor: AppColors.surfaceStrong,
                    indicatorColor: AppColors.accent,
                    height: 60,
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
          ),
        ),
      ),
    );
  }

  int _indexForLocation(String location) {
    if (location.startsWith('/review')) return 1;
    if (location.startsWith('/progress')) return 2;
    if (location.startsWith('/settings')) return 3;
    return 0;
  }

  void _goToTab(BuildContext context, int index) {
    ScaffoldMessenger.maybeOf(context)?.hideCurrentSnackBar();

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
