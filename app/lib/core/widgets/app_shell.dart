import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../ads/ad_ids.dart';
import '../ads/banner_ad_widget.dart';
import '../theme/app_colors.dart';
import '../theme/theme_mode_provider.dart';
import '../../features/review/domain/review_provider.dart';
import '../../features/subscription/data/subscription_repository.dart';
import '../../features/subscription/domain/subscription_provider.dart';

class AppShell extends ConsumerWidget {
  final String location;
  final Widget child;

  const AppShell({super.key, required this.location, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Watch the theme mode so the shell (including the bottom nav border
    // and shadow, which read non-reactive AppColors getters) rebuilds when
    // the user toggles light/dark.
    ref.watch(themeModeProvider);

    // Cross-feature cache reset when premium tier flips. The review hub
    // shows a different cap (3 vs unlimited) per tier, but
    // reviewQueueProvider is a regular FutureProvider with no autoDispose
    // — without this listener a user's queue stays stale after upgrade /
    // refund / expiry until they pull-to-refresh. AppShell sits above
    // every tab so the listener fires regardless of which screen is up.
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

    final currentIndex = _indexForLocation(location);
    final adTab = _adTabForLocation(location);

    // No gradient here: MaterialApp.builder already paints the gradient
    // behind everything. Letting the Scaffold be transparent keeps a single
    // source of truth and lets theme switches update the background.
    return Scaffold(
      extendBody: true,
      backgroundColor: Colors.transparent,
      body: child,
      // 배너 광고는 bottomNavigationBar 영역 위에 column으로 묶어 nav가
      // 광고를 가리지 않게. premium 사용자는 BannerAdWidget이 SizedBox.
      // shrink 반환 → 광고 영역 자체 사라짐.
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Center(child: BannerAdWidget(tab: adTab)),
          ),
          SafeArea(
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
        ],
      ),
    );
  }

  int _indexForLocation(String location) {
    if (location.startsWith('/review')) return 1;
    if (location.startsWith('/progress')) return 2;
    if (location.startsWith('/settings')) return 3;
    return 0;
  }

  AdTab _adTabForLocation(String location) {
    if (location.startsWith('/review')) return AdTab.review;
    if (location.startsWith('/progress')) return AdTab.progress;
    if (location.startsWith('/settings')) return AdTab.settings;
    return AdTab.today;
  }

  void _goToTab(BuildContext context, int index) {
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
