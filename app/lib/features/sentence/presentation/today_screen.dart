import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/ads/ad_ids.dart';
import '../../../core/ads/banner_ad_widget.dart';
import '../../../core/analytics/analytics_service.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widget/home_widget_service.dart';
import '../../../features/auth/domain/auth_provider.dart';
import '../../../features/auth/domain/auth_model.dart';
import '../../../core/review/review_prompt_service.dart';
import '../../../features/progress/domain/progress_provider.dart';
import '../../tts/tts_service.dart';
import 'today_share_sheet.dart';
import '../../vocabulary/data/vocabulary_repository.dart';
import '../../vocabulary/domain/vocabulary_model.dart';
import '../../vocabulary/domain/vocabulary_provider.dart';
import '../../vocabulary/presentation/word_form_detail_sheet.dart';
import '../data/sentence_repository.dart';
import '../domain/sentence_model.dart';
import '../domain/sentence_provider.dart';

void _pushToWidget(TodaySentence? t) {
  if (t == null) return;
  HomeWidgetService.updateTodaySentence(
    text: t.sentence.text,
    translation: t.sentence.translation,
    assignedDate: t.assignedDate,
    pronunciation: t.sentence.pronunciation,
    situation: t.sentence.situation,
    words: [
      for (final w in t.sentence.words)
        (word: w.word, meaning: w.meaning),
    ],
  );
}

void _pushVocabToWidget(VocabularyList? list) {
  if (list == null) return;
  HomeWidgetService.updateVocabulary([
    for (final v in list.items)
      (
        word: v.word,
        meaning: v.meaning ?? '',
        sentence: v.sentenceText ?? '',
        translation: v.sentenceTranslation ?? '',
        status: v.status,
      ),
  ]);
}

class TodayScreen extends ConsumerWidget {
  const TodayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final todayAsync = ref.watch(todaySentenceProvider);
    final user = ref.watch(authStateProvider).asData?.value;

    ref.listen(todaySentenceProvider, (_, next) {
      _pushToWidget(next.asData?.value);
    });
    _pushToWidget(todayAsync.asData?.value);

    ref.listen(vocabularyListProvider, (_, next) {
      _pushVocabToWidget(next.asData?.value);
    });
    _pushVocabToWidget(ref.read(vocabularyListProvider).asData?.value);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: const Text('오늘의 루프'),
        actions: [
          IconButton(
            tooltip: '히스토리',
            icon: const Icon(Icons.history_rounded),
            onPressed: () => context.push('/history'),
          ),
        ],
      ),
      body: todayAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => _StateMessage(
          icon: Icons.error_outline_rounded,
          title: '오늘 문장을 불러오지 못했어요',
          message: error.toString(),
          actionLabel: '다시 시도',
          onAction: () => ref.invalidate(todaySentenceProvider),
        ),
        data: (today) => _TodayContent(today: today, user: user),
      ),
    );
  }
}

class _TodayContent extends ConsumerWidget {
  final TodaySentence today;
  final UserInfo? user;

  const _TodayContent({required this.today, required this.user});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sentence = today.sentence;
    final theme = Theme.of(context);

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(todaySentenceProvider),
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
        children: [
          _HeroBanner(today: today, user: user),
          const SizedBox(height: 20),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      // "이번 문장 학습 중" pill — 화면이 active 할당만
                      // 보여주므로 항상 학습 중 상태. 완료 시점에
                      // 서버가 다음 문장을 새 active로 만들어 주므로
                      // 이 화면에서 "완료" 상태는 도달 불가능 (heatmap/
                      // hero stat이 완료 카운트를 책임짐).
                      _Pill(
                        icon: Icons.repeat_rounded,
                        label: '이번 문장 학습 중',
                        color: AppColors.primary,
                      ),
                      if (sentence.situation != null)
                        _Pill(
                          icon: Icons.place_outlined,
                          label: sentence.situation!,
                          color: AppColors.info,
                        ),
                      _DifficultyBadge(difficulty: sentence.difficulty),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Text(
                    sentence.text,
                    style: theme.textTheme.headlineMedium?.copyWith(
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    sentence.translation,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton.icon(
                      onPressed: () => TodayShareSheet.show(
                        context,
                        sentence: sentence,
                      ),
                      icon: const Icon(Icons.ios_share_rounded, size: 18),
                      label: const Text('공유'),
                    ),
                  ),
                  if (sentence.pronunciation != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLight,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Text(
                        sentence.pronunciation!,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: AppColors.textHint,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  Builder(
                    builder: (context) {
                      final speakButton = ElevatedButton.icon(
                        onPressed: () {
                          ref
                              .read(analyticsServiceProvider)
                              .logPronunciationPlayed(kind: 'sentence');
                          ref
                              .read(ttsServiceProvider)
                              .speak(
                                sentence.text,
                                language: ttsLocaleForCode(
                                  user?.targetLanguage ?? 'en',
                                ),
                              );
                        },
                        icon: const Icon(Icons.volume_up_rounded),
                        label: const Text('발음 듣기'),
                      );

                      if (!AppConstants.premiumEnabled) {
                        return SizedBox(
                          width: double.infinity,
                          child: speakButton,
                        );
                      }

                      // '복습' — 모든 유저에게 동일. 해당 문장 4문제 페이지로.
                      // 프리미엄 일일 퀴즈와는 별개 흐름(서버에서 attempt
                      // source 분리, stats 미반영).
                      return Row(
                        children: [
                          Expanded(child: speakButton),
                          const SizedBox(width: 12),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => context.push(
                                '/sentence-review/${sentence.id}',
                              ),
                              icon: const Icon(Icons.quiz_outlined),
                              label: const Text('문제 풀기'),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 10),
                  _ActionButtons(
                    assignmentId: today.assignmentId,
                    sentenceId: sentence.id,
                  ),
                ],
              ),
            ),
          ),
          // 문장 카드와 단어 해설 사이 배너 광고 — premium 사용자에겐
          // 자동으로 SizedBox.shrink. 스크롤 내부라 nav 위 고정 위치보다
          // 자연스러운 흐름.
          const SizedBox(height: 16),
          const Center(child: BannerAdWidget(tab: AdTab.today)),
          if (sentence.words.isNotEmpty) ...[
            const SizedBox(height: 24),
            _SectionTitle(
              title: '단어 해설',
              subtitle: '책갈피(🔖) 버튼을 누르면 단어장에 모아져요. 나중에 단어장에서 활용형·예문까지 다시 볼 수 있어요.',
            ),
            const SizedBox(height: 12),
            ...sentence.words.map(
              (word) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _WordCard(
                  word: word,
                  sentenceId: sentence.id,
                  sentenceText: sentence.text,
                ),
              ),
            ),
          ],
          if (sentence.grammarNotes.isNotEmpty) ...[
            const SizedBox(height: 24),
            _SectionTitle(
              title: '문장 포인트',
              subtitle: '헷갈리기 쉬운 표현과 구조를 짧게 정리했어요.',
            ),
            const SizedBox(height: 12),
            ...sentence.grammarNotes.map(
              (note) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _GrammarCard(note: note),
              ),
            ),
          ],
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

/// 액션 버튼 (skip / complete). busy 동안 비활성화 + 실패 시 SnackBar.
/// _TodayContent에서 분리한 이유: 익명 람다에 setState/try-catch를
/// 끼우려면 부모를 StatefulWidget으로 만들어야 하는데, 그러면
/// _TodayContent 전체가 불필요하게 stateful해짐.
class _ActionButtons extends ConsumerStatefulWidget {
  final int assignmentId;
  final int sentenceId;

  const _ActionButtons({
    required this.assignmentId,
    required this.sentenceId,
  });

  @override
  ConsumerState<_ActionButtons> createState() => _ActionButtonsState();
}

class _ActionButtonsState extends ConsumerState<_ActionButtons> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() task, {required String errLabel}) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await task();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$errLabel 실패. 다시 시도해 주세요.')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _skip() => _run(() async {
        await ref
            .read(sentenceRepositoryProvider)
            .skipAssignment(widget.assignmentId);
        ref.invalidate(todaySentenceProvider);
      }, errLabel: '넘기기');

  Future<void> _complete() => _run(() async {
        await ref
            .read(sentenceRepositoryProvider)
            .completeAssignment(widget.assignmentId);
        // 학습 완료 funnel — daily active 사용자/완료율 측정에 핵심.
        // sentenceId는 분석 dashboard에서 popular sentence 파악에 사용.
        ref
            .read(analyticsServiceProvider)
            .logSentenceCompleted(widget.sentenceId);
        ref.invalidate(todaySentenceProvider);
        ref.invalidate(sentenceHistoryProvider(1));
        ref.invalidate(learningStatsProvider);
        ref.invalidate(heatmapProvider);
        ref.invalidate(weeklyReportProvider);
        ref.invalidate(achievementsProvider);
        // 완료 직후 최신 streak으로 리뷰 prompt 후보 평가. 실패는
        // silent (stats fetch가 실패해도 학습 완료 자체는 OK).
        try {
          final stats = await ref.read(learningStatsProvider.future);
          await ref
              .read(reviewPromptServiceProvider)
              .maybePromptAfterStreak(stats.streak);
        } catch (_) {}
      }, errLabel: '완료 처리');

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: _busy ? null : _skip,
            icon: const Icon(Icons.skip_next_rounded),
            label: const Text('문장 넘기기'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: ElevatedButton.icon(
            onPressed: _busy ? null : _complete,
            icon: _busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation(Colors.white),
                    ),
                  )
                : const Icon(Icons.check_circle_rounded),
            label: const Text('학습 완료'),
          ),
        ),
      ],
    );
  }
}

class _HeroBanner extends ConsumerWidget {
  final TodaySentence today;
  final UserInfo? user;

  const _HeroBanner({required this.today, required this.user});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // 오늘 완료한 문장 수 — heatmap이 timezone 보정된 값을 가짐.
    // active 화면에선 today.isCompleted가 늘 false라 의미 없는 boolean
    // 대신 이 카운트로 사용자가 오늘 얼마나 했는지 보여줌.
    final todayCount =
        ref.watch(heatmapProvider).asData?.value.todayCount ?? 0;
    final isPremium = user?.isPremium == true;

    // 무거운 그라데이션 배너 대신 가벼운 스탯 카드 2개. 문장 카드가
    // 화면의 주인공이 되도록 상단을 비운다.
    return Row(
      children: [
        Expanded(
          child: _HeroStat(
            icon: Icons.check_circle_rounded,
            label: '오늘 완료',
            value: '$todayCount문장',
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _HeroStat(
            icon: isPremium
                ? Icons.workspace_premium_rounded
                : Icons.repeat_rounded,
            label: isPremium ? '프리미엄 루프' : '무료 플랜',
            value: isPremium ? '문장+퀴즈' : '문장 반복',
          ),
        ),
      ],
    );
  }
}

class _HeroStat extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _HeroStat({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 22, color: AppColors.primary),
          const SizedBox(height: 12),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;
  final String subtitle;

  const _SectionTitle({required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 4),
        Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}

class _StateMessage extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  const _StateMessage({
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 48, color: AppColors.error),
                const SizedBox(height: 16),
                Text(title, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 20),
                ElevatedButton(onPressed: onAction, child: Text(actionLabel)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _Pill({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _DifficultyBadge extends StatelessWidget {
  final String difficulty;

  const _DifficultyBadge({required this.difficulty});

  @override
  Widget build(BuildContext context) {
    late final Color color;
    late final String label;

    switch (difficulty) {
      case 'beginner':
        color = AppColors.beginner;
        label = '초급';
        break;
      case 'intermediate':
        color = AppColors.intermediate;
        label = '중급';
        break;
      case 'advanced':
        color = AppColors.advanced;
        label = '고급';
        break;
      default:
        color = AppColors.beginner;
        label = difficulty;
        break;
    }

    return _Pill(icon: Icons.bolt_outlined, label: label, color: color);
  }
}

class _WordCard extends ConsumerStatefulWidget {
  final WordDetail word;
  final int sentenceId;
  final String sentenceText;

  const _WordCard({
    required this.word,
    required this.sentenceId,
    required this.sentenceText,
  });

  @override
  ConsumerState<_WordCard> createState() => _WordCardState();
}

class _WordCardState extends ConsumerState<_WordCard> {
  bool _saving = false;

  Future<void> _saveToVocabulary() async {
    setState(() => _saving = true);
    try {
      await ref
          .read(vocabularyRepositoryProvider)
          .add(
            word: widget.word.word,
            meaning: widget.word.meaning,
            context: widget.word.example ?? widget.sentenceText,
            sentenceId: widget.sentenceId,
          );
      ref
          .read(analyticsServiceProvider)
          .logWordBookmarked(widget.word.word);
      // Refresh the shared list so the bookmark state (here and on the
      // vocabulary screen) reflects the save immediately and persists
      // across tab switches.
      ref.invalidate(vocabularyListProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('단어장에 "${widget.word.word}" 저장됨')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('단어장 저장에 실패했어요')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final word = widget.word;
    final saved =
        ref
            .watch(vocabularyListProvider)
            .asData
            ?.value
            .items
            .any((v) => v.word == word.word) ??
        false;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        // 카드 자체 tap → 활용형/예문 사전. 단어장 카드와 동일 패턴.
        // 북마크/발음 IconButton은 자체 GestureDetector라 outer InkWell
        // 흡수 안 함 — 의도된 동작 유지.
        onTap: () => WordFormDetailSheet.show(
          context,
          word: word.word,
          highlightSurface: word.word,
        ),
        child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        word.word,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      if (word.partOfSpeech != null)
                        _Pill(
                          icon: Icons.label_outline_rounded,
                          label: word.partOfSpeech!,
                          color: AppColors.info,
                        ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: saved ? '저장됨' : '단어장에 저장',
                  onPressed: _saving || saved ? null : _saveToVocabulary,
                  icon: Icon(
                    saved
                        ? Icons.bookmark_rounded
                        : Icons.bookmark_border_rounded,
                  ),
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.surfaceLight,
                    foregroundColor: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: () {
                    ref
                        .read(analyticsServiceProvider)
                        .logPronunciationPlayed(kind: 'word');
                    ref.read(ttsServiceProvider).speak(
                          word.word,
                          language: ttsLocaleForCode(
                            ref
                                    .read(authStateProvider)
                                    .asData
                                    ?.value
                                    ?.targetLanguage ??
                                'en',
                          ),
                        );
                  },
                  icon: const Icon(Icons.volume_up_outlined),
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.surfaceLight,
                    foregroundColor: AppColors.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(word.meaning, style: Theme.of(context).textTheme.bodyLarge),
            if (word.example != null) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  word.example!,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ],
          ],
        ),
        ),
      ),
    );
  }
}

class _GrammarCard extends StatelessWidget {
  final GrammarNoteDetail note;

  const _GrammarCard({required this.note});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(note.title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            Text(
              note.explanation,
              style: Theme.of(
                context,
              ).textTheme.bodyLarge?.copyWith(color: AppColors.textSecondary),
            ),
            if (note.example != null) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  note.example!,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.primaryDark,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
