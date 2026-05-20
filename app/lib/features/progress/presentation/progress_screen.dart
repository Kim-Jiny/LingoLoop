import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_constants.dart';
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
            tooltip: '복습 루프',
            onPressed: () => context.push('/review'),
            icon: const Icon(Icons.replay_rounded),
          ),
          IconButton(
            tooltip: '문장 검색',
            onPressed: () => context.push('/search'),
            icon: const Icon(Icons.search_rounded),
          ),
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
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          ref.invalidate(learningStatsProvider);
          ref.invalidate(achievementsProvider);
          ref.invalidate(weeklyReportProvider);
          ref.invalidate(heatmapProvider);
        },
        child: statsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => ListView(
            children: [
              Padding(
                padding: const EdgeInsets.all(24),
                child: Text('통계를 불러오지 못했어요.\n$error',
                    textAlign: TextAlign.center),
              ),
            ],
          ),
          data: (stats) => _StatsContent(stats: stats),
        ),
      ),
    );
  }
}

class _StatsContent extends ConsumerWidget {
  final LearningStats stats;

  const _StatsContent({required this.stats});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final achievementsAsync = ref.watch(achievementsProvider);
    final weeklyAsync = ref.watch(weeklyReportProvider);
    final heatmapAsync = ref.watch(heatmapProvider);

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
                      value: AppConstants.premiumEnabled
                          ? '${stats.quizAccuracy}%'
                          : '🔒 준비 중',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        // maxCrossAxisExtent caps each cell at ~200dp wide. Phones
        // (~360dp viewport) render 2 columns like before; tablets
        // (~800dp+) render 4 columns instead of two giant cards.
        GridView.extent(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          maxCrossAxisExtent: 200,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.0,
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
              icon: AppConstants.premiumEnabled
                  ? Icons.quiz_rounded
                  : Icons.lock_outline_rounded,
              label: '퀴즈 도전',
              value: AppConstants.premiumEnabled
                  ? '${stats.quizTotalAttempts}회'
                  : '준비 중',
              accent: AppConstants.premiumEnabled
                  ? AppColors.info
                  : AppColors.textHint,
            ),
            _StatCard(
              icon: AppConstants.premiumEnabled
                  ? Icons.check_circle_rounded
                  : Icons.lock_outline_rounded,
              label: '맞춘 문제',
              value: AppConstants.premiumEnabled
                  ? '${stats.quizCorrectCount}회'
                  : '준비 중',
              accent: AppConstants.premiumEnabled
                  ? AppColors.success
                  : AppColors.textHint,
            ),
          ],
        ),
        const SizedBox(height: 24),
        Text('오늘의 목표', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        heatmapAsync.when(
          loading: () => const Card(
            child: Padding(
              padding: EdgeInsets.all(28),
              child: Center(child: CircularProgressIndicator()),
            ),
          ),
          error: (e, _) => const _LoadFailedCard(
            message: '학습 현황을 불러오지 못했어요.',
          ),
          data: (h) => _GoalHeatmapCard(data: h),
        ),
        const SizedBox(height: 24),
        Text('이번 주 리포트', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        weeklyAsync.when(
          loading: () => const Card(
            child: Padding(
              padding: EdgeInsets.all(28),
              child: Center(child: CircularProgressIndicator()),
            ),
          ),
          error: (error, _) => const _LoadFailedCard(
            message: '주간 리포트를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
          ),
          data: (report) => _WeeklyReportCard(report: report),
        ),
        const SizedBox(height: 24),
        achievementsAsync.when(
          loading: () => const Card(
            child: Padding(
              padding: EdgeInsets.all(28),
              child: Center(child: CircularProgressIndicator()),
            ),
          ),
          error: (error, _) => const _LoadFailedCard(
            message: '업적 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
          ),
          data: (summary) => _AchievementsSection(summary: summary),
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
        if (AppConstants.premiumEnabled)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  _DetailRow(
                      label: '총 시도',
                      value: '${stats.quizTotalAttempts}회'),
                  const Divider(height: 24),
                  _DetailRow(
                    label: '정답',
                    value: '${stats.quizCorrectCount}회',
                    valueColor: AppColors.success,
                  ),
                  const Divider(height: 24),
                  _DetailRow(
                    label: '오답',
                    value:
                        '${stats.quizTotalAttempts - stats.quizCorrectCount}회',
                    valueColor: AppColors.error,
                  ),
                ],
              ),
            ),
          )
        else
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  Icon(Icons.lock_outline_rounded,
                      color: AppColors.textHint),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      '퀴즈는 준비 중이에요. 곧 학습 기록에 정답률·세부 기록이 함께 표시돼요.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                ],
              ),
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

class _WeeklyReportCard extends StatelessWidget {
  final WeeklyReport report;

  const _WeeklyReportCard({required this.report});

  @override
  Widget build(BuildContext context) {
    final maxCount = report.daily.fold<int>(
      1,
      (m, d) => d.sentences + d.quizAttempts > m
          ? d.sentences + d.quizAttempts
          : m,
    );

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${report.from} ~ ${report.to}',
                style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _MiniStat(
                    label: '학습일',
                    value: '${report.activeDays}/7',
                  ),
                ),
                Expanded(
                  child: _MiniStat(
                    label: '문장',
                    value: '${report.totalSentences}',
                  ),
                ),
                Expanded(
                  child: _MiniStat(
                    label: '퀴즈정답률',
                    value: AppConstants.premiumEnabled
                        ? '${report.quizAccuracy}%'
                        : '🔒',
                  ),
                ),
                Expanded(
                  child: _MiniStat(
                    label: '새 단어',
                    value: '${report.vocabAdded}',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            SizedBox(
              height: 108,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: report.daily.map((d) {
                  final total = d.sentences + d.quizAttempts;
                  final ratio = total / maxCount;
                  return Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Container(
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          height: 8 + ratio * 56,
                          decoration: BoxDecoration(
                            color: total > 0
                                ? AppColors.primary
                                : AppColors.surfaceLight,
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _weekdayLabel(d.date),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _weekdayLabel(String isoDate) {
    try {
      final d = DateTime.parse(isoDate);
      const labels = ['월', '화', '수', '목', '금', '토', '일'];
      return labels[d.weekday - 1];
    } catch (_) {
      return '';
    }
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;

  const _MiniStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value,
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(color: AppColors.primary)),
        const SizedBox(height: 4),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _AchievementsSection extends StatelessWidget {
  final AchievementSummary summary;

  const _AchievementsSection({required this.summary});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('업적', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(width: 8),
            Text(
              '${summary.unlockedCount}/${summary.total}',
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ),
        const SizedBox(height: 12),
        // Same cap pattern as the stat grid — phones get 2 columns,
        // tablets get 4+ instead of two oversized badges.
        GridView.extent(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          maxCrossAxisExtent: 220,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 2.1,
          children:
              summary.achievements.map((a) => _BadgeCard(badge: a)).toList(),
        ),
      ],
    );
  }
}

class _BadgeCard extends StatelessWidget {
  final Achievement badge;

  const _BadgeCard({required this.badge});

  @override
  Widget build(BuildContext context) {
    final color = badge.unlocked ? AppColors.primary : AppColors.textHint;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                _iconFor(badge.icon),
                color: color,
                size: 22,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    badge.title,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: badge.unlocked
                              ? AppColors.textPrimary
                              : AppColors.textSecondary,
                        ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  if (badge.unlocked)
                    Text('달성 완료',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.success,
                            fontWeight: FontWeight.w600))
                  else
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        value: badge.progress,
                        minHeight: 6,
                        backgroundColor: AppColors.surfaceLight,
                        valueColor: AlwaysStoppedAnimation<Color>(
                            AppColors.primary),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _iconFor(String name) {
    switch (name) {
      case 'flag':
        return Icons.flag_rounded;
      case 'local_fire_department':
        return Icons.local_fire_department_rounded;
      case 'whatshot':
        return Icons.whatshot_rounded;
      case 'menu_book':
        return Icons.menu_book_rounded;
      case 'auto_stories':
        return Icons.auto_stories_rounded;
      case 'check_circle':
        return Icons.check_circle_rounded;
      case 'gps_fixed':
        return Icons.gps_fixed_rounded;
      case 'bookmark':
        return Icons.bookmark_rounded;
      default:
        return Icons.star_rounded;
    }
  }
}

class _GoalHeatmapCard extends StatelessWidget {
  final HeatmapData data;

  const _GoalHeatmapCard({required this.data});

  Color _cellColor(int count) {
    if (count <= 0) return AppColors.surfaceLight;
    if (count >= data.goal) return AppColors.primary;
    if (count >= (data.goal / 2).ceil()) {
      return AppColors.primary.withValues(alpha: 0.55);
    }
    return AppColors.primary.withValues(alpha: 0.28);
  }

  @override
  Widget build(BuildContext context) {
    final reached = data.todayCount >= data.goal;
    final ratio = data.goal == 0
        ? 0.0
        : (data.todayCount / data.goal).clamp(0.0, 1.0);

    // Build the day list from `since` → `today` (inclusive).
    final since = DateTime.tryParse(data.since);
    final today = DateTime.tryParse(data.today);
    final cells = <Widget>[];
    if (since != null && today != null) {
      String two(int n) => n.toString().padLeft(2, '0');
      for (var d = since;
          !d.isAfter(today);
          d = d.add(const Duration(days: 1))) {
        final key = '${d.year}-${two(d.month)}-${two(d.day)}';
        final c = data.counts[key] ?? 0;
        cells.add(
          Container(
            width: 13,
            height: 13,
            decoration: BoxDecoration(
              color: _cellColor(c),
              borderRadius: BorderRadius.circular(3),
            ),
          ),
        );
      }
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  '${data.todayCount} / ${data.goal}',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        color: reached
                            ? AppColors.success
                            : AppColors.primary,
                      ),
                ),
                const SizedBox(width: 10),
                Text(
                  reached ? '오늘 목표 달성! 🎉' : '오늘 학습 진행 중',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: ratio,
                minHeight: 12,
                backgroundColor: AppColors.surfaceLight,
                valueColor: AlwaysStoppedAnimation<Color>(
                  reached ? AppColors.success : AppColors.primary,
                ),
              ),
            ),
            if (cells.isNotEmpty) ...[
              const SizedBox(height: 18),
              Text('학습 히트맵',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 10),
              Wrap(spacing: 4, runSpacing: 4, children: cells),
              const SizedBox(height: 8),
              Text(
                '진한 칸일수록 그날 더 많이 학습했어요.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _LoadFailedCard extends StatelessWidget {
  final String message;

  const _LoadFailedCard({required this.message});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Icon(Icons.cloud_off_rounded, color: AppColors.textHint),
            const SizedBox(width: 12),
            Expanded(
              child: Text(message,
                  style: Theme.of(context).textTheme.bodyMedium),
            ),
          ],
        ),
      ),
    );
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
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(
                context,
              ).textTheme.headlineMedium?.copyWith(fontSize: 24),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
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
      ],
    );
  }
}
