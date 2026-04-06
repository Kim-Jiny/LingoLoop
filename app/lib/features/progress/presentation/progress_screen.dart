import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../domain/progress_model.dart';
import '../domain/progress_provider.dart';

class ProgressScreen extends ConsumerWidget {
  const ProgressScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(learningStatsProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: const Text('학습 기록'),
        actions: [
          IconButton(
            tooltip: '문장 히스토리',
            onPressed: () => context.push('/history'),
            icon: const Icon(Icons.history_rounded),
          ),
          IconButton(
            tooltip: '문장별 진행도',
            onPressed: () => context.push('/sentence-progress'),
            icon: const Icon(Icons.view_list_rounded),
          ),
        ],
      ),
      body: statsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('통계를 불러오지 못했어요.\n$error', textAlign: TextAlign.center),
          ),
        ),
        data: (stats) => _StatsContent(stats: stats),
      ),
    );
  }
}

class _StatsContent extends StatelessWidget {
  final LearningStats stats;

  const _StatsContent({required this.stats});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
      children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(32),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF2E2319), Color(0xFF5A4333)],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '반복이 실력으로 바뀌는 중',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(color: Colors.white),
              ),
              const SizedBox(height: 10),
              Text(
                '${stats.streak}일 연속으로 루프를 이어가고 있어요.',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Colors.white.withValues(alpha: 0.82),
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _HeroMetric(
                      label: '완료 문장',
                      value: '${stats.completedSentences}',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _HeroMetric(
                      label: '퀴즈 정답률',
                      value: '${stats.quizAccuracy}%',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.15,
          children: [
            _StatCard(
              icon: Icons.menu_book_rounded,
              label: '학습한 문장',
              value: '${stats.totalSentences}',
              accent: AppColors.primary,
            ),
            _StatCard(
              icon: Icons.local_fire_department_rounded,
              label: '연속 학습',
              value: '${stats.streak}일',
              accent: AppColors.warning,
            ),
            _StatCard(
              icon: Icons.quiz_rounded,
              label: '퀴즈 도전',
              value: '${stats.quizTotalAttempts}회',
              accent: AppColors.info,
            ),
            _StatCard(
              icon: Icons.check_circle_rounded,
              label: '맞춘 문제',
              value: '${stats.quizCorrectCount}회',
              accent: AppColors.success,
            ),
          ],
        ),
        const SizedBox(height: 24),
        Text('루프 숙련도', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      '${stats.avgMasteryScore}%',
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(
                            color: _masteryColor(stats.avgMasteryScore),
                          ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: _masteryColor(
                          stats.avgMasteryScore,
                        ).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        _masteryLabel(stats.avgMasteryScore),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: _masteryColor(stats.avgMasteryScore),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    value: stats.avgMasteryScore / 100,
                    minHeight: 14,
                    backgroundColor: AppColors.surfaceLight,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      _masteryColor(stats.avgMasteryScore),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  _masteryMessage(stats.avgMasteryScore),
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        Text('퀴즈 세부 기록', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                _DetailRow(label: '총 시도', value: '${stats.quizTotalAttempts}회'),
                const Divider(height: 24),
                _DetailRow(
                  label: '정답',
                  value: '${stats.quizCorrectCount}회',
                  valueColor: AppColors.success,
                ),
                const Divider(height: 24),
                _DetailRow(
                  label: '오답',
                  value: '${stats.quizTotalAttempts - stats.quizCorrectCount}회',
                  valueColor: AppColors.error,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Color _masteryColor(int score) {
    if (score >= 80) return AppColors.success;
    if (score >= 50) return AppColors.warning;
    return AppColors.error;
  }

  String _masteryLabel(int score) {
    if (score >= 80) return '안정권';
    if (score >= 50) return '성장 중';
    return '복습 필요';
  }

  String _masteryMessage(int score) {
    if (score >= 80) return '문장 패턴이 꽤 몸에 익었습니다. 퀴즈 푸시를 섞으면 더 오래 갑니다.';
    if (score >= 50) return '기초는 잡혔어요. 오늘 문장을 자주 듣고 퀴즈를 한 번 더 풀어보세요.';
    if (score > 0) return '아직 기억이 흔들릴 수 있어요. 더 자주 노출되도록 푸시 주기를 줄여보세요.';
    return '아직 측정 데이터가 적어요. 오늘 문장을 듣고 퀴즈부터 시작해보세요.';
  }
}

class _HeroMetric extends StatelessWidget {
  final String label;
  final String value;

  const _HeroMetric({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Colors.white.withValues(alpha: 0.72),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(color: Colors.white),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color accent;

  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.accent,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: accent),
            ),
            const Spacer(),
            Text(
              value,
              style: Theme.of(
                context,
              ).textTheme.headlineMedium?.copyWith(fontSize: 26),
            ),
            const SizedBox(height: 4),
            Text(label, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _DetailRow({required this.label, required this.value, this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: Theme.of(context).textTheme.bodyLarge),
        Text(
          value,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: valueColor ?? AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: () => context.push('/sentence-progress'),
          icon: const Icon(Icons.track_changes_outlined),
          label: const Text('문장별 진행도 보기'),
        ),
      ],
    );
  }
}
