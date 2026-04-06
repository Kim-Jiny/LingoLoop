import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../features/auth/domain/auth_provider.dart';
import '../../../features/auth/domain/auth_model.dart';
import '../../../features/progress/domain/progress_provider.dart';
import '../../tts/tts_service.dart';
import '../data/sentence_repository.dart';
import '../domain/sentence_model.dart';
import '../domain/sentence_provider.dart';

class TodayScreen extends ConsumerWidget {
  const TodayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final todayAsync = ref.watch(todaySentenceProvider);
    final user = ref.watch(authStateProvider).asData?.value;

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
          IconButton(
            tooltip: '로그아웃',
            icon: const Icon(Icons.logout_rounded),
            onPressed: () => ref.read(authStateProvider.notifier).logout(),
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
                      _Pill(
                        icon: Icons.repeat_rounded,
                        label: today.isCompleted ? '오늘 루프 완료' : '오늘 루프 진행 중',
                        color: today.isCompleted
                            ? AppColors.success
                            : AppColors.primary,
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
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            ref
                                .read(ttsServiceProvider)
                                .speak(
                                  sentence.text,
                                  language: _ttsLanguage(
                                    user?.targetLanguage ?? 'en',
                                  ),
                                );
                          },
                          icon: const Icon(Icons.volume_up_rounded),
                          label: const Text('발음 듣기'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => context.go('/quiz'),
                          icon: const Icon(Icons.quiz_outlined),
                          label: Text(
                            user?.isPremium == true ? '문장 퀴즈' : '프리미엄 보기',
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (!today.isCompleted) ...[
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: TextButton.icon(
                        onPressed: () async {
                          await ref
                              .read(sentenceRepositoryProvider)
                              .completeAssignment(today.assignmentId);
                          ref.invalidate(todaySentenceProvider);
                          ref.invalidate(sentenceHistoryProvider(1));
                          ref.invalidate(learningStatsProvider);
                        },
                        icon: const Icon(Icons.check_circle_outline_rounded),
                        label: const Text('오늘 문장 복습 완료'),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          _SectionTitle(
            title: '오늘 이 문장을 이렇게 각인해요',
            subtitle: '앱을 자주 열지 않아도 푸시와 퀴즈로 계속 노출되는 구조예요.',
          ),
          const SizedBox(height: 12),
          const _LoopStepGrid(),
          if (sentence.words.isNotEmpty) ...[
            const SizedBox(height: 24),
            _SectionTitle(
              title: '단어 해설',
              subtitle: '문장 속 핵심 단어만 빠르게 익히고 바로 다시 문장으로 돌아옵니다.',
            ),
            const SizedBox(height: 12),
            ...sentence.words.map(
              (word) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _WordCard(word: word),
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
          const SizedBox(height: 24),
          _SectionTitle(
            title: '빠른 이동',
            subtitle: '루프 설정, 퀴즈, 학습 기록을 바로 이어서 볼 수 있어요.',
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _QuickActionCard(
                  icon: Icons.tune_rounded,
                  title: '푸시 루프',
                  subtitle: '1시간마다 반복 알림 설정',
                  onTap: () => context.go('/notification-settings'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _QuickActionCard(
                  icon: Icons.insights_rounded,
                  title: '학습 기록',
                  subtitle: '연속 학습과 숙련도 확인',
                  onTap: () => context.go('/progress'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroBanner extends StatelessWidget {
  final TodaySentence today;
  final UserInfo? user;

  const _HeroBanner({required this.today, required this.user});

  @override
  Widget build(BuildContext context) {
    final greeting = user?.nickname ?? user?.email.split('@').first ?? '학습자';

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(30),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFF26B3A), Color(0xFFFFA86E)],
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.22),
            blurRadius: 24,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'LingoLoop',
            style: Theme.of(context).textTheme.displaySmall?.copyWith(
              color: Colors.white,
              fontSize: 30,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            '$greeting님, 오늘도 한 문장을 생활 속에 심어둘 시간이에요.',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(color: Colors.white, height: 1.4),
          ),
          const SizedBox(height: 12),
          Text(
            '${today.assignedDate} 문장 • ${user?.isPremium == true ? '프리미엄 루프 활성화' : '무료 하루 한 줄 플랜'}',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.84),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: _HeroStat(
                  label: '오늘 노출',
                  value: today.isCompleted ? '완료' : '진행 중',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _HeroStat(
                  label: '추천 루프',
                  value: user?.isPremium == true ? '문장+퀴즈' : '문장 반복',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  final String label;
  final String value;

  const _HeroStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Colors.white.withValues(alpha: 0.8),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(color: Colors.white),
          ),
        ],
      ),
    );
  }
}

class _LoopStepGrid extends StatelessWidget {
  const _LoopStepGrid();

  @override
  Widget build(BuildContext context) {
    const items = [
      (
        icon: Icons.notifications_active_outlined,
        title: '자주 노출',
        text: '설정한 주기로 문장이 다시 도착해요.',
      ),
      (
        icon: Icons.headphones_outlined,
        title: '소리로 각인',
        text: '열자마자 발음과 리듬을 다시 들어요.',
      ),
      (
        icon: Icons.auto_awesome_outlined,
        title: '포인트 학습',
        text: '단어 뜻과 문장 주의점을 짧게 확인해요.',
      ),
      (
        icon: Icons.extension_outlined,
        title: '퀴즈 확장',
        text: '프리미엄은 문제 푸시까지 섞어서 반복해요.',
      ),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: items.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 1.04,
      ),
      itemBuilder: (context, index) {
        final item = items[index];
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
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(item.icon, color: AppColors.primary),
                ),
                const Spacer(),
                Text(
                  item.title,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 6),
                Text(item.text, style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _QuickActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(28),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: AppColors.primary),
              ),
              const SizedBox(height: 18),
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 6),
              Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
            ],
          ),
        ),
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

class _WordCard extends ConsumerWidget {
  final WordDetail word;

  const _WordCard({required this.word});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
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
                  onPressed: () => ref
                      .read(ttsServiceProvider)
                      .speak(
                        word.word,
                        language: _ttsLanguage(
                          ref
                                  .read(authStateProvider)
                                  .asData
                                  ?.value
                                  ?.targetLanguage ??
                              'en',
                        ),
                      ),
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
    );
  }
}

String _ttsLanguage(String code) {
  switch (code) {
    case 'ja':
      return 'ja-JP';
    case 'es':
      return 'es-ES';
    case 'ko':
      return 'ko-KR';
    case 'en':
    default:
      return 'en-US';
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
