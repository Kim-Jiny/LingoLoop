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
      appBar: AppBar(
        title: const Text('학습 현황'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: statsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.error),
              const SizedBox(height: 16),
              Text('통계를 불러올 수 없습니다',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => ref.invalidate(learningStatsProvider),
                child: const Text('다시 시도'),
              ),
            ],
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
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Streak card
          Card(
            color: AppColors.primary,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('연속 학습',
                          style: TextStyle(
                              color: Colors.white70, fontSize: 14)),
                      const SizedBox(height: 4),
                      Text(
                        '${stats.streak}일',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 36,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  const Icon(Icons.local_fire_department,
                      size: 48, color: Colors.orangeAccent),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Stats grid
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  icon: Icons.menu_book,
                  label: '학습한 문장',
                  value: '${stats.totalSentences}',
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatCard(
                  icon: Icons.check_circle_outline,
                  label: '완료한 문장',
                  value: '${stats.completedSentences}',
                  color: AppColors.success,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  icon: Icons.quiz_outlined,
                  label: '퀴즈 도전',
                  value: '${stats.quizTotalAttempts}',
                  color: AppColors.info,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatCard(
                  icon: Icons.trending_up,
                  label: '퀴즈 정답률',
                  value: '${stats.quizAccuracy}%',
                  color: AppColors.warning,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Mastery progress
          Text('평균 숙련도',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: LinearProgressIndicator(
                            value: stats.avgMasteryScore / 100,
                            minHeight: 12,
                            backgroundColor: AppColors.surfaceLight,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              _masteryColor(stats.avgMasteryScore),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Text(
                        '${stats.avgMasteryScore}%',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: _masteryColor(stats.avgMasteryScore),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _masteryMessage(stats.avgMasteryScore),
                    style: TextStyle(
                        color: AppColors.textSecondary, fontSize: 14),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Quiz breakdown
          Text('퀴즈 상세',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  _DetailRow(
                      label: '총 도전 횟수',
                      value: '${stats.quizTotalAttempts}회'),
                  const Divider(),
                  _DetailRow(
                      label: '정답',
                      value: '${stats.quizCorrectCount}회',
                      valueColor: AppColors.success),
                  const Divider(),
                  _DetailRow(
                      label: '오답',
                      value:
                          '${stats.quizTotalAttempts - stats.quizCorrectCount}회',
                      valueColor: AppColors.error),
                ],
              ),
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Color _masteryColor(int score) {
    if (score >= 80) return AppColors.success;
    if (score >= 50) return AppColors.warning;
    return AppColors.error;
  }

  String _masteryMessage(int score) {
    if (score >= 80) return '훌륭해요! 높은 숙련도를 유지하고 있습니다.';
    if (score >= 50) return '좋아요! 꾸준히 복습하면 더 좋아질 거예요.';
    if (score > 0) return '퀴즈를 더 풀어서 숙련도를 높여보세요!';
    return '퀴즈를 풀면 숙련도가 측정됩니다.';
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 12),
            Text(value,
                style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 4),
            Text(label,
                style: TextStyle(
                    color: AppColors.textSecondary, fontSize: 13)),
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

  const _DetailRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style:
                  TextStyle(color: AppColors.textSecondary, fontSize: 15)),
          Text(value,
              style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                  color: valueColor ?? AppColors.textPrimary)),
        ],
      ),
    );
  }
}
