import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/domain/auth_provider.dart';
import '../domain/quiz_model.dart';
import '../domain/quiz_provider.dart';

/// 퀴즈 기록 — quiz tab과 동일한 4분류(오늘/단어/문장/배열)로 분리
/// 표시. 사용자가 단어 quiz였는데 sentence 본문이 정답으로 표시돼
/// 혼동되던 문제 해결. 누적 정답률 요약 card는 탭 상단 공통.
///
/// JA 학습자는 배열 탭을 숨김 — quiz_screen과 동일 분기. 시드 문장이
/// 공백 없는 일본어라 generateArrangeQuiz가 null을 반환해 기록도 안
/// 쌓이는 탭이라 노출할 이유가 없음.
class QuizHistoryScreen extends ConsumerWidget {
  const QuizHistoryScreen({super.key});

  static const _allTabs = <({String label, String? category})>[
    (label: '오늘', category: 'today'),
    (label: '단어', category: 'wordTyping'),
    (label: '문장', category: 'sentenceTyping'),
    (label: '배열', category: 'sentenceArrange'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progressAsync = ref.watch(quizProgressProvider);
    final lang = ref.watch(authStateProvider).asData?.value?.targetLanguage;
    final tabs = lang == 'ja'
        ? _allTabs.where((t) => t.category != 'sentenceArrange').toList()
        : _allTabs;

    return DefaultTabController(
      length: tabs.length,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text('퀴즈 기록'),
          bottom: TabBar(
            isScrollable: true,
            tabs: [for (final t in tabs) Tab(text: t.label)],
          ),
        ),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: _ProgressSummaryCard(progressAsync: progressAsync),
            ),
            Expanded(
              child: TabBarView(
                children: [
                  for (final t in tabs)
                    _CategoryHistoryView(category: t.category),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoryHistoryView extends ConsumerWidget {
  final String? category;

  const _CategoryHistoryView({required this.category});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(quizHistoryProvider(category));
    return historyAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            '퀴즈 기록을 불러오지 못했어요.\n$error',
            textAlign: TextAlign.center,
          ),
        ),
      ),
      data: (history) {
        if (history.items.isEmpty) {
          return const Padding(
            padding: EdgeInsets.fromLTRB(20, 12, 20, 32),
            child: _EmptyHistoryCard(),
          );
        }
        return RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async => ref.invalidate(quizHistoryProvider(category)),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            itemCount: history.items.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final item = history.items[index];
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: item.isCorrect
                                  ? AppColors.success.withValues(alpha: 0.12)
                                  : AppColors.error.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              item.isCorrect ? '정답' : '오답',
                              style: TextStyle(
                                color: item.isCorrect
                                    ? AppColors.success
                                    : AppColors.error,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const Spacer(),
                          Text(
                            _historyLabel(item),
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                      if (item.sentenceText != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          item.sentenceText!,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ],
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Icon(
                            Icons.schedule_rounded,
                            size: 15,
                            color: AppColors.textSecondary,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            _formatAttemptedAt(item.attemptedAt),
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

/// 히스토리 라벨 — quiz.type만 보면 신규 모드(word_to_english /
/// sentence_input / listening)가 전부 'fill_blank'로 묶여서 사용자가
/// 무슨 퀴즈를 풀었는지 분간 못 함. question.mode를 우선 확인해
/// 의미 있는 한국어 라벨을 보여줌.
String _historyLabel(QuizHistoryItem item) {
  final mode = item.question['mode'] as String?;
  if (mode == 'word_to_english') return '단어 입력';
  if (mode == 'sentence_input') return '문장 입력';
  if (mode == 'listening') return '리스닝';
  switch (item.quizType) {
    case 'fill_blank':
      return '빈칸 채우기';
    case 'word_order':
      return '단어 배열';
    case 'translation':
      return '번역하기';
    case 'multiple_choice':
      return '객관식';
    default:
      return item.quizType;
  }
}

String _formatAttemptedAt(String raw) {
  final parsed = DateTime.tryParse(raw);
  if (parsed == null) return raw;

  final local = parsed.toLocal();
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final date = DateTime(local.year, local.month, local.day);
  final time = '${_twoDigits(local.hour)}:${_twoDigits(local.minute)}';

  if (date == today) return '오늘 $time';
  if (date == today.subtract(const Duration(days: 1))) return '어제 $time';
  if (local.year == now.year) return '${local.month}월 ${local.day}일 $time';
  return '${local.year}.${_twoDigits(local.month)}.${_twoDigits(local.day)} $time';
}

String _twoDigits(int value) => value.toString().padLeft(2, '0');

class _ProgressSummaryCard extends StatelessWidget {
  final AsyncValue<QuizProgress> progressAsync;

  const _ProgressSummaryCard({required this.progressAsync});

  @override
  Widget build(BuildContext context) {
    return progressAsync.when(
      loading: () => const Card(
        child: Padding(
          padding: EdgeInsets.all(20),
          child: Center(
            child: SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        ),
      ),
      error: (_, _) => const SizedBox.shrink(),
      data: (p) {
        if (p.attempts == 0) return const SizedBox.shrink();
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      '누적 정답률',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const Spacer(),
                    Text(
                      '${p.accuracy}%',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${p.attempts}회 도전 · ${p.correct}회 정답 · ${p.sentences}문장',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                if (p.byDifficulty.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  for (final level in const [
                    'beginner',
                    'intermediate',
                    'advanced',
                  ])
                    if (p.byDifficulty[level] != null)
                      _MasteryBar(
                        level: level,
                        mastery: p.byDifficulty[level]!.mastery,
                      ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _MasteryBar extends StatelessWidget {
  final String level;
  final int mastery;

  const _MasteryBar({required this.level, required this.mastery});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (level) {
      'beginner' => ('초급', AppColors.success),
      'intermediate' => ('중급', AppColors.warning),
      'advanced' => ('고급', AppColors.error),
      _ => (level, AppColors.textSecondary),
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          SizedBox(
            width: 44,
            child: Text(
              label,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: (mastery / 100).clamp(0, 1),
                minHeight: 8,
                backgroundColor: AppColors.surfaceLight,
                valueColor: AlwaysStoppedAnimation<Color>(color),
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 36,
            child: Text(
              '$mastery%',
              textAlign: TextAlign.right,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: color,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyHistoryCard extends StatelessWidget {
  const _EmptyHistoryCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Center(
          child: Text(
            '아직 퀴즈 기록이 없습니다.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ),
      ),
    );
  }
}
