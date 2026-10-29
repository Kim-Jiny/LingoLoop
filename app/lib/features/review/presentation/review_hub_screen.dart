import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/ads/ad_ids.dart';
import '../../../core/ads/banner_ad_widget.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/cartoon.dart';
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

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('복습')),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async => ref.invalidate(reviewQueueProvider),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
          children: [
            CartoonCard(
              color: AppColors.accent,
              padding: const EdgeInsets.all(22),
              radius: 28,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      BounceIn(
                        child: Mascot(
                          mood: dueCount > 0
                              ? MascotMood.think
                              : MascotMood.cheer,
                          size: 56,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '기억을 다시 꺼낼 시간',
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              queueAsync.isLoading
                                  ? '복습할 문장을 확인하고 있어요…'
                                  : dueCount > 0
                                  ? '지금 다시 떠올리면 좋은 문장이에요.'
                                  : '지금은 복습할 문장이 없어요. 잘 따라오고 있어요!',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (dueCount > 0) ...[
                    const SizedBox(height: 16),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          '$dueCount',
                          style: Theme.of(context).textTheme.displaySmall
                              ?.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '문장 · 망각곡선 기반',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () => context.push('/review/session'),
                        icon: const Icon(Icons.replay_rounded),
                        label: const Text('복습 시작'),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            // ListView 안이라 높이가 무한 — stretch는 IntrinsicHeight 없이는
            // 렌더 예외로 화면이 통째로 비어 버린다.
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: _TileCard(
                      icon: Icons.bookmark_rounded,
                      title: '단어장',
                      subtitle: '저장한 단어 모아 보고 발음 듣기',
                      onTap: () => context.push('/vocabulary'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    // 모든 유저를 /quiz로 보낸다. 비프리미엄은 화면이 알아서
                    // _QuizLockedPreview(흐리게 미리보기 + 업셀 배너)를 보여줌.
                    child: _TileCard(
                      icon: Icons.quiz_rounded,
                      title: '퀴즈',
                      subtitle: '문장·단어·리스닝으로 다시 풀기',
                      trailing: isPremium
                          ? null
                          : _Chip(label: 'PREMIUM', color: AppColors.primary),
                      onTap: () => context.push('/quiz'),
                    ),
                  ),
                ],
              ),
            ),
            // 퀴즈 카드 아래 배너 광고 — premium은 자동 hidden.
            const SizedBox(height: 16),
            const Center(child: BannerAdWidget(tab: AdTab.review)),
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

class _TileCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback onTap;

  const _TileCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return CartoonCard(
      onTap: onTap,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: AppColors.primary),
              ),
              const Spacer(),
              ?trailing,
            ],
          ),
          const SizedBox(height: 14),
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}
