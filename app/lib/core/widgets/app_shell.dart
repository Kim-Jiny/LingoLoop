import 'dart:async';

import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, TargetPlatform;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show HapticFeedback;
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

  static const _hideDuration = Duration(milliseconds: 550);
  static const _showDuration = Duration(milliseconds: 350);

  static const _androidGap = 12.0;
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
        // 숨을 때는 천천히(눈에 거슬리지 않게), 다시 나올 때는 조금 경쾌하게.
        duration: _hidden ? _hideDuration : _showDuration,
        curve: _hidden ? Curves.easeInOutCubic : Curves.easeOutCubic,
        offset: _hidden ? const Offset(0, 1.6) : Offset.zero,
        child: AnimatedOpacity(
          duration: _hidden ? _hideDuration : _showDuration,
          opacity: _hidden ? 0 : 1,
          child: IgnorePointer(
            ignoring: _hidden,
            child: Padding(
              padding: _barPadding(context),
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
                    child: _CartoonTabBar(
                      key: const ValueKey('app-tab-bar'),
                      selectedIndex: currentIndex,
                      onSelected: (index) => _goToTab(context, index),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// 탭바 바깥 여백. 안드로이드는 시스템 내비게이션 바(3버튼/제스처 바)
  /// 높이 위에 [_androidGap]을 더 띄워 바에 붙어 보이지 않게 하고, iOS는
  /// 홈 인디케이터 높이를 그대로 쓴다.
  EdgeInsets _barPadding(BuildContext context) {
    final inset = MediaQuery.viewPaddingOf(context).bottom;
    final bottom = defaultTargetPlatform == TargetPlatform.android
        ? inset + _androidGap
        : (inset > 16 ? inset : 16.0);
    return EdgeInsets.fromLTRB(16, 0, 16, bottom);
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

/// 탭바 안쪽 여백(알약 ↔ 바 테두리) 과 알약 높이. 바 높이 = 높이 + 여백×2 = 60.
const double _barInset = 7;
const double _pillHeight = 46;

class _TabSpec {
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  const _TabSpec(this.icon, this.selectedIcon, this.label);
}

const _tabs = [
  _TabSpec(Icons.wb_sunny_outlined, Icons.wb_sunny, '오늘'),
  _TabSpec(Icons.replay_outlined, Icons.replay, '복습'),
  _TabSpec(Icons.insights_outlined, Icons.insights, '기록'),
  _TabSpec(Icons.settings_outlined, Icons.settings, '설정'),
];

/// 아이콘과 글자를 한 알약으로 감싸는 탭바. 알약 안쪽 여백은 상하좌우 같고,
/// 아이콘-글자 간격은 좁혀 가운데로 모았다.
/// 알약 하나가 탭바 위를 미끄러지듯 움직이는 탭바. 탭하면 그 칸으로 이동하고,
/// 좌우로 드래그하면 알약이 손가락을 따라가다 손을 떼면 가장 가까운 탭으로
/// 붙으며 그 화면으로 이동한다.
class _CartoonTabBar extends StatefulWidget {
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  const _CartoonTabBar({
    super.key,
    required this.selectedIndex,
    required this.onSelected,
  });

  @override
  State<_CartoonTabBar> createState() => _CartoonTabBarState();
}

class _CartoonTabBarState extends State<_CartoonTabBar> {
  /// 드래그 중 알약의 왼쪽 위치(dp). null이면 칸에 붙어 있는 상태.
  double? _dragLeft;

  /// 드래그가 끝난 직후, 화면 전환이 반영되기 전까지 알약이 머무를 칸.
  int? _pending;
  Timer? _pendingTimer;

  /// 드래그 중 알약이 걸쳐 있는 칸.
  int? _hover;

  @override
  void didUpdateWidget(_CartoonTabBar old) {
    super.didUpdateWidget(old);
    // 선택이 실제로 바뀌면(화면 전환 반영) 임시 위치는 더 필요 없다.
    if (old.selectedIndex != widget.selectedIndex) _clearPending();
  }

  @override
  void dispose() {
    _pendingTimer?.cancel();
    super.dispose();
  }

  void _clearPending() {
    _pendingTimer?.cancel();
    _pending = null;
  }

  int _indexAt(double left, double slot) =>
      ((left + slot / 2) / slot).floor().clamp(0, _tabs.length - 1);

  void _drag(double dx, double slot, double width) {
    final left = (dx - slot / 2).clamp(0.0, width - slot);
    final index = _indexAt(left, slot);
    if (index != _hover) HapticFeedback.selectionClick();
    setState(() {
      _dragLeft = left;
      _hover = index;
    });
  }

  void _endDrag() {
    final target = _hover;
    setState(() {
      _dragLeft = null;
      _hover = null;
    });
    if (target == null) return;
    if (target != widget.selectedIndex) {
      // 전환이 반영될 때까지(보통 한 프레임) 알약이 되돌아가지 않게 붙잡아 둔다.
      _pending = target;
      _pendingTimer?.cancel();
      _pendingTimer = Timer(const Duration(milliseconds: 600), () {
        if (mounted) setState(() => _pending = null);
      });
      widget.onSelected(target);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dragging = _dragLeft != null;
    final active = _hover ?? _pending ?? widget.selectedIndex;
    return Container(
      color: AppColors.surfaceStrong,
      padding: const EdgeInsets.all(_barInset),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          final slot = width / _tabs.length;
          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            onHorizontalDragStart: (d) =>
                _drag(d.localPosition.dx, slot, width),
            onHorizontalDragUpdate: (d) =>
                _drag(d.localPosition.dx, slot, width),
            onHorizontalDragEnd: (_) => _endDrag(),
            onHorizontalDragCancel: _endDrag,
            child: SizedBox(
              height: _pillHeight,
              child: Stack(
                children: [
                  // 미끄러지는 알약 하나. 드래그 중에는 즉시 손가락을 따라간다.
                  AnimatedPositioned(
                    key: const ValueKey('tab-pill'),
                    duration: dragging
                        ? Duration.zero
                        : const Duration(milliseconds: 260),
                    curve: Curves.easeOutCubic,
                    left: (_dragLeft ?? active * slot) + 1,
                    width: slot - 2,
                    top: 0,
                    bottom: 0,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: AppColors.accent,
                        // 바 반경 30에 동심.
                        borderRadius: BorderRadius.circular(30 - _barInset),
                        border: Border.all(
                          color: AppColors.textPrimary.withValues(alpha: 0.85),
                          width: 1.6,
                        ),
                      ),
                    ),
                  ),
                  // 알약 높이를 꽉 채워야 아이콘·글자가 세로 가운데에 놓이고
                  // 탭 영역도 알약 전체를 덮는다.
                  Positioned.fill(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        for (var i = 0; i < _tabs.length; i++)
                          Expanded(
                            child: _TabItem(
                              spec: _tabs[i],
                              selected: i == active,
                              onTap: () => widget.onSelected(i),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _TabItem extends StatelessWidget {
  final _TabSpec spec;
  final bool selected;
  final VoidCallback onTap;

  const _TabItem({
    required this.spec,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.primary : AppColors.textHint;
    return Semantics(
      button: true,
      selected: selected,
      label: spec.label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                selected ? spec.selectedIcon : spec.icon,
                size: 22,
                color: color,
              ),
              const SizedBox(height: 1),
              Text(
                spec.label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontSize: 11,
                  height: 1.2,
                  color: color,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
