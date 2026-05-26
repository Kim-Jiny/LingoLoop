import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/domain/auth_provider.dart';
import '../domain/review_provider.dart';

class ReviewHubScreen extends ConsumerWidget {
  const ReviewHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queueAsync = ref.watch(reviewQueueProvider);
    final user = ref.watch(authStateProvider).asData?.value;
    final isPremium = user?.isPremium ?? false;
    final queue = queueAsync.asData?.value;
    final dueCount = queue?.total ?? 0;
    final freeCapped = queue?.freeCapped ?? false;
    final freeLimit = queue?.freeLimit ?? 3;

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
                  if (freeCapped) ...[
                    const SizedBox(height: 6),
                    Text(
                      '무료 플랜은 한 번에 $freeLimit개까지 복습할 수 있어요.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.78),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),
            _HubCard(
              icon: Icons.replay_rounded,
              title: '복습 시작',
              subtitle: dueCount > 0
                  ? (freeCapped
                      ? '$dueCount문장 중 $freeLimit개부터 시작'
                      : '망각곡선 기반 $dueCount문장 다시보기')
                  : '복습 대상이 쌓이면 여기서 시작해요',
              enabled: dueCount > 0,
              trailing: freeCapped
                  ? _Chip(label: 'PREMIUM 무제한', color: AppColors.primary)
                  : null,
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
              // Same copy regardless of plan — the PREMIUM chip on the
              // right already tells the user this is gated, no need
              // to repeat the gating in the subtitle.
              subtitle: '오늘 문장 / 복습 큐 / 단어 / 리스닝으로 다시 풀어보기',
              enabled: true,
              trailing: isPremium
                  ? null
                  : _Chip(label: 'PREMIUM', color: AppColors.primary),
              // Route every user to /quiz. The screen handles non-
              // premium itself with `_QuizLockedPreview` — a real
              // dimmed preview of all four quiz modes + an upsell
              // banner. Sending free users straight to /subscription
              // skipped that preview entirely and dumped them on a
              // page titled "프리미엄".
              onTap: () => context.push('/quiz'),
            ),
          ],
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
