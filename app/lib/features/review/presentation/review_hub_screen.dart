import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/analytics/analytics_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/version/version_gate.dart';
import '../../auth/domain/auth_provider.dart';
import '../domain/review_provider.dart';

class ReviewHubScreen extends ConsumerWidget {
  const ReviewHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queueAsync = ref.watch(reviewQueueProvider);
    final user = ref.watch(authStateProvider).asData?.value;
    final isPremium = user?.isPremium ?? false;
    final iapUnlocked = ref.watch(iapUnlockedProvider);
    final dueCount = queueAsync.asData?.value.total ?? 0;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('복습')),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async => ref.invalidate(reviewQueueProvider),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
          children: [
            // Hero card stays full-opacity for everyone — the value
            // prop ("기억을 다시 꺼낼 시간") is the same regardless of
            // plan, and dimming the only thing above the upsell
            // banner would just look broken.
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(28),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFFF26B3A), Color(0xFFFFA86E)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.22),
                    blurRadius: 24,
                    offset: const Offset(0, 14),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '기억을 다시 꺼낼 시간',
                    style: Theme.of(
                      context,
                    ).textTheme.titleLarge?.copyWith(color: Colors.white),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    queueAsync.isLoading
                        ? '복습할 문장을 확인하고 있어요…'
                        : dueCount > 0
                        ? '지금 다시 떠올리면 좋은 문장이 $dueCount개 있어요.'
                        : '지금은 복습할 문장이 없어요. 잘 따라오고 있어요!',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Colors.white.withValues(alpha: 0.86),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            // Upsell banner — only for users who aren't premium yet.
            // Tapping it routes to /subscription, which is itself
            // version-aware (shows the locked preview in 1.0.x and
            // the real purchase flow in 1.1.0+).
            if (!isPremium) ...[
              _PremiumUpsellBanner(iapUnlocked: iapUnlocked),
              const SizedBox(height: 16),
            ],
            // Whole cards section dims for non-premium users so the
            // tab visually reads as "premium territory you're
            // previewing." Cards stay tappable — 복습 / 단어장 are
            // genuinely free-tier-functional, and the 퀴즈 card
            // routes to /subscription on its own.
            Opacity(
              opacity: isPremium ? 1 : 0.55,
              child: Column(
                children: [
                  _HubCard(
                    icon: Icons.replay_rounded,
                    title: '복습 시작',
                    subtitle: dueCount > 0
                        ? '망각곡선 기반 $dueCount문장 다시보기'
                        : '복습 대상이 쌓이면 여기서 시작해요',
                    enabled: dueCount > 0,
                    onTap: () => context.push('/review/session'),
                  ),
                  const SizedBox(height: 12),
                  _HubCard(
                    icon: Icons.bookmark_rounded,
                    title: '단어장',
                    subtitle: '저장한 단어를 모아 보고 발음 듣기',
                    enabled: true,
                    onTap: () => context.push('/vocabulary'),
                  ),
                  const SizedBox(height: 12),
                  _HubCard(
                    icon: Icons.quiz_rounded,
                    title: '퀴즈',
                    subtitle: isPremium
                        ? '오늘 문장 / 복습 큐 / 단어 / 리스닝으로 다시 풀어보기'
                        : '프리미엄에서 다양한 퀴즈로 한 번 더 굳히기',
                    enabled: true,
                    trailing: isPremium
                        ? null
                        : _Chip(label: 'PREMIUM', color: AppColors.primary),
                    onTap: () {
                      if (isPremium) {
                        context.push('/quiz');
                      } else {
                        ref
                            .read(analyticsServiceProvider)
                            .logSubscriptionUpsellOpened('review_hub_quiz_card');
                        context.push('/subscription');
                      }
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Sticky-feeling upsell card surfaced above the hub list for
/// non-premium users. Adapts copy based on whether real IAP is
/// wired (1.1.0+) or the build is still preview-locked (1.0.x).
class _PremiumUpsellBanner extends ConsumerWidget {
  final bool iapUnlocked;
  const _PremiumUpsellBanner({required this.iapUnlocked});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Card(
      color: AppColors.accent,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () {
          ref
              .read(analyticsServiceProvider)
              .logSubscriptionUpsellOpened('review_hub_banner');
          context.push('/subscription');
        },
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  iapUnlocked
                      ? Icons.workspace_premium_rounded
                      : Icons.lock_outline_rounded,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      iapUnlocked
                          ? '프리미엄으로 더 풍성한 복습'
                          : '프리미엄, 곧 만나요',
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: AppColors.primaryDark,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      iapUnlocked
                          ? '퀴즈 · 복습 큐 · 단어 / 리스닝 퀴즈까지 한 번에 이용하시려면 구독해주세요.'
                          : '다음 업데이트에서 퀴즈와 맞춤 복습이 열려요. 미리보기로 둘러보세요.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppColors.primaryDark,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(Icons.chevron_right_rounded, color: AppColors.primaryDark),
            ],
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;

  const _Chip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _HubCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool enabled;
  final Widget? trailing;
  final VoidCallback onTap;

  const _HubCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.enabled,
    required this.onTap,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    final dim = !enabled;
    return Opacity(
      opacity: dim ? 0.55 : 1,
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(26),
          onTap: enabled ? onTap : null,
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(icon, color: AppColors.primary),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
                if (trailing != null) ...[
                  const SizedBox(width: 8),
                  trailing!,
                ] else
                  const Icon(Icons.chevron_right_rounded),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
