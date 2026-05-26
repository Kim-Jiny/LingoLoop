import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/analytics/analytics_service.dart';
import '../../../core/network/error_message.dart';
import '../../../core/version/version_gate.dart';
import '../../auth/domain/auth_provider.dart';
import '../../tts/tts_service.dart';
import '../domain/quiz_model.dart';
import '../domain/quiz_provider.dart';

class QuizScreen extends ConsumerWidget {
  const QuizScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final iapUnlocked = ref.watch(iapUnlockedProvider);

    return authState.when(
      loading: () => Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(title: const Text('퀴즈')),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(title: const Text('퀴즈')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              friendlyErrorMessage(error, fallback: '사용자 정보를 확인하지 못했어요.'),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
      data: (user) {
        // Non-premium: show a preview of what the quiz tab offers —
        // upsell banner at the top + dimmed list of the four quiz modes.
        // Server endpoints all 403 for free users so we never try to load
        // real quiz data here.
        if (user == null || !user.isPremium) {
          return Scaffold(
            backgroundColor: Colors.transparent,
            appBar: AppBar(title: const Text('퀴즈')),
            body: _QuizLockedPreview(iapUnlocked: iapUnlocked),
          );
        }

        return DefaultTabController(
          length: 3,
          child: Scaffold(
            backgroundColor: Colors.transparent,
            appBar: AppBar(
              title: const Text('퀴즈'),
              actions: [
                IconButton(
                  onPressed: () => context.push('/quiz-history'),
                  icon: const Icon(Icons.history_rounded),
                ),
              ],
              bottom: const TabBar(
                tabs: [
                  Tab(text: '오늘'),
                  Tab(text: '단어'),
                  Tab(text: '문장'),
                ],
              ),
            ),
            body: Column(
              children: [
                const Expanded(
                  child: TabBarView(
                    children: [
                      _QuizTab(
                        source: _QuizSource.today,
                        emptyTitle: '오늘/어제 학습한 문장이 없어요',
                        emptyBody: '오늘 문장을 한 번 풀어보면 여기에 퀴즈가 생깁니다.',
                      ),
                      _WordTab(),
                      _QuizTab(
                        source: _QuizSource.sentenceTyping,
                        emptyTitle: '이번 달 완료한 문장이 없어요',
                        emptyBody: '문장을 완료하면 그 달 동안 랜덤으로 다시 풀어볼 수 있어요.',
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

enum _QuizSource {
  today,
  wordLearning,
  wordReview,
  sentenceTyping,
  // Legacy sources kept so historical screens/routes can still
  // reference them; removed from the main tab list.
  daily,
  review,
  words,
  listening,
  sentenceListening,
}

/// Word tab houses two sub-modes — 단어장학습 (status='learning') and
/// 완료복습 (status='learned'). Both use the same meaning→English
/// typing format, just a different source filter. SegmentedButton
/// toggles between them.
class _WordTab extends StatefulWidget {
  const _WordTab();

  @override
  State<_WordTab> createState() => _WordTabState();
}

class _WordTabState extends State<_WordTab> {
  _QuizSource _mode = _QuizSource.wordLearning;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: SegmentedButton<_QuizSource>(
            segments: const [
              ButtonSegment(
                value: _QuizSource.wordLearning,
                label: Text('단어장학습'),
                icon: Icon(Icons.school_rounded, size: 18),
              ),
              ButtonSegment(
                value: _QuizSource.wordReview,
                label: Text('완료복습'),
                icon: Icon(Icons.check_circle_outline_rounded, size: 18),
              ),
            ],
            selected: {_mode},
            onSelectionChanged: (sel) => setState(() => _mode = sel.first),
            showSelectedIcon: false,
          ),
        ),
        Expanded(
          child: _mode == _QuizSource.wordLearning
              ? const _QuizTab(
                  source: _QuizSource.wordLearning,
                  emptyTitle: '학습 중인 단어가 없어요',
                  emptyBody: '문장 화면에서 단어를 단어장에 담으면 여기서 풀어볼 수 있어요.',
                )
              : const _QuizTab(
                  source: _QuizSource.wordReview,
                  emptyTitle: '완료한 단어가 없어요',
                  emptyBody: '단어장에서 단어를 "완료"로 옮기면 복습 퀴즈가 생깁니다.',
                ),
        ),
      ],
    );
  }
}

/// Listening tab houses two sub-modes — word listening (4-way MC) and
/// sentence listening (free-text fill-blank). A segmented control at
/// the top toggles between them. Made stateful so we don't have to
/// hoist segment state up to the TabController and risk it leaking
/// into other tabs.
class _ListeningTab extends StatefulWidget {
  const _ListeningTab();

  @override
  State<_ListeningTab> createState() => _ListeningTabState();
}

class _ListeningTabState extends State<_ListeningTab> {
  _QuizSource _mode = _QuizSource.listening;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: SegmentedButton<_QuizSource>(
            segments: const [
              ButtonSegment(
                value: _QuizSource.listening,
                label: Text('단어'),
                icon: Icon(Icons.text_fields_rounded, size: 18),
              ),
              ButtonSegment(
                value: _QuizSource.sentenceListening,
                label: Text('문장'),
                icon: Icon(Icons.short_text_rounded, size: 18),
              ),
            ],
            selected: {_mode},
            onSelectionChanged: (sel) => setState(() => _mode = sel.first),
            showSelectedIcon: false,
          ),
        ),
        Expanded(
          child: _mode == _QuizSource.listening
              ? const _QuizTab(
                  source: _QuizSource.listening,
                  emptyTitle: '리스닝 퀴즈를 만들 단어가 없어요',
                  emptyBody: '단어장에 단어가 적어도 4개 이상 모이면 발음 리스닝 퀴즈가 생성됩니다.',
                )
              : const _QuizTab(
                  source: _QuizSource.sentenceListening,
                  emptyTitle: '문장 리스닝 퀴즈가 없어요',
                  emptyBody: '최근 7일 안에 학습한 문장으로 만듭니다. 오늘의 문장을 먼저 풀어보세요.',
                ),
        ),
      ],
    );
  }
}

/// Shared body for each of the three quiz tabs. Picks the right
/// provider based on `source`, then routes through the same
/// `_QuizLauncher → quiz session → results` flow.
class _QuizTab extends ConsumerWidget {
  final _QuizSource source;
  final String emptyTitle;
  final String emptyBody;
  const _QuizTab({
    required this.source,
    required this.emptyTitle,
    required this.emptyBody,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = switch (source) {
      _QuizSource.today => ref.watch(todayQuizProvider),
      _QuizSource.wordLearning => ref.watch(wordLearningQuizProvider),
      _QuizSource.wordReview => ref.watch(wordReviewQuizProvider),
      _QuizSource.sentenceTyping => ref.watch(sentenceTypingQuizProvider),
      _QuizSource.daily => ref.watch(dailyQuizProvider),
      _QuizSource.review => ref.watch(reviewQueueProvider),
      _QuizSource.words => ref.watch(wordQuizProvider),
      _QuizSource.listening => ref.watch(wordListeningQuizProvider),
      _QuizSource.sentenceListening => ref.watch(sentenceListeningQuizProvider),
    };
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _QuizErrorView(
        error: error,
        source: source.name,
        onRetry: () {
          switch (source) {
            case _QuizSource.today:
              ref.invalidate(todayQuizProvider);
            case _QuizSource.wordLearning:
              ref.invalidate(wordLearningQuizProvider);
            case _QuizSource.wordReview:
              ref.invalidate(wordReviewQuizProvider);
            case _QuizSource.sentenceTyping:
              ref.invalidate(sentenceTypingQuizProvider);
            case _QuizSource.daily:
              ref.invalidate(dailyQuizProvider);
            case _QuizSource.review:
              ref.invalidate(reviewQueueProvider);
            case _QuizSource.words:
              ref.invalidate(wordQuizProvider);
            case _QuizSource.listening:
              ref.invalidate(wordListeningQuizProvider);
            case _QuizSource.sentenceListening:
              ref.invalidate(sentenceListeningQuizProvider);
          }
        },
      ),
      data: (quiz) {
        if (quiz.quizzes.isEmpty) {
          return _QuizEmptyState(title: emptyTitle, body: emptyBody);
        }
        return _QuizLauncher(quiz: quiz, source: source.name);
      },
    );
  }
}

class _QuizErrorView extends ConsumerStatefulWidget {
  final Object error;
  final String source;
  final VoidCallback onRetry;

  const _QuizErrorView({
    required this.error,
    required this.source,
    required this.onRetry,
  });

  @override
  ConsumerState<_QuizErrorView> createState() => _QuizErrorViewState();
}

class _QuizErrorViewState extends ConsumerState<_QuizErrorView> {
  bool _handledForbidden = false;

  @override
  void initState() {
    super.initState();
    _handleForbiddenIfNeeded();
  }

  @override
  void didUpdateWidget(covariant _QuizErrorView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.error, widget.error)) {
      _handledForbidden = false;
      _handleForbiddenIfNeeded();
    }
  }

  void _handleForbiddenIfNeeded() {
    if (_handledForbidden || !_isForbidden(widget.error)) return;
    _handledForbidden = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      ref.read(quizSessionProvider(widget.source).notifier).reset();
      await ref.read(authStateProvider.notifier).refreshCurrentUser();
    });
  }

  @override
  Widget build(BuildContext context) {
    final isForbidden = _isForbidden(widget.error);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.error_outline_rounded,
                  size: 48,
                  color: AppColors.error,
                ),
                const SizedBox(height: 16),
                Text(
                  isForbidden ? '프리미엄 플랜 확인이 필요해요' : '퀴즈를 불러올 수 없어요',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  isForbidden
                      ? '플랜이 만료되었거나 구독 상태가 바뀌었을 수 있어요. 최신 상태를 확인한 뒤 다시 이용해 주세요.'
                      : friendlyErrorMessage(
                          widget.error,
                          fallback: '퀴즈를 불러오지 못했어요.',
                        ),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: widget.onRetry,
                  child: Text(isForbidden ? '구독 상태 다시 확인' : '다시 시도'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _QuizEmptyState extends StatelessWidget {
  final String title;
  final String body;
  const _QuizEmptyState({required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Icon(
                    Icons.school_outlined,
                    color: AppColors.primary,
                    size: 30,
                  ),
                ),
                const SizedBox(height: 16),
                Text(title, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                Text(
                  body,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Replaces the old single-card paywall. Free users land on the
/// quiz screen and see a top banner pushing them to /subscription,
/// followed by a dimmed preview of the four quiz tabs so they know
/// what they're missing. Tabs are non-functional (server 403s
/// anyway), tapping them just re-fires the upsell.
class _QuizLockedPreview extends ConsumerWidget {
  final bool iapUnlocked;
  const _QuizLockedPreview({required this.iapUnlocked});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    void openUpsell(String source) {
      ref.read(analyticsServiceProvider).logSubscriptionUpsellOpened(source);
      context.push('/subscription');
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
      children: [
        // Banner. Tappable only when there's somewhere to send the
        // user — in 1.0.x there's no real /subscription flow yet, so
        // we render the same card as a static notice instead of
        // bouncing them through another "곧 출시" screen.
        Card(
          color: AppColors.accent,
          child: InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: iapUnlocked ? () => openUpsell('quiz_paywall_banner') : null,
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(15),
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
                          iapUnlocked ? '퀴즈는 프리미엄 전용이에요' : '퀴즈, 곧 만나요',
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: AppColors.primaryDark,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          iapUnlocked
                              ? '구독하시면 4가지 퀴즈 모드를 모두 이용할 수 있어요.'
                              : '다음 업데이트에서 4가지 퀴즈 모드가 열려요.',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: AppColors.primaryDark,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (iapUnlocked) ...[
                    const SizedBox(width: 8),
                    Icon(
                      Icons.chevron_right_rounded,
                      color: AppColors.primaryDark,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 18),
        Text(
          iapUnlocked ? '프리미엄에서 풀 수 있어요' : '다음 업데이트에서 만나요',
          style: theme.textTheme.titleMedium,
        ),
        const SizedBox(height: 10),
        // Dimmed feature preview.
        Opacity(
          opacity: 0.55,
          child: Column(
            children: const [
              _LockedFeatureCard(
                icon: Icons.today_rounded,
                title: '오늘의 퀴즈',
                subtitle: '오늘 학습한 문장을 빈칸/어순/번역/단어 객관식으로 다시 풀어보기',
              ),
              SizedBox(height: 10),
              _LockedFeatureCard(
                icon: Icons.replay_rounded,
                title: '복습 큐 (SRS)',
                subtitle: '최근 30일 안에 틀린 문장을 망각곡선 기반으로 다시 출제',
              ),
              SizedBox(height: 10),
              _LockedFeatureCard(
                icon: Icons.bookmark_rounded,
                title: '단어 퀴즈',
                subtitle: '저장한 단어장 기반 4지선다로 매일 새로운 셋',
              ),
              SizedBox(height: 10),
              _LockedFeatureCard(
                icon: Icons.headphones_rounded,
                title: '리스닝',
                subtitle: '단어 발음을 듣고 의미 맞히기 (TTS 자동 재생)',
              ),
            ],
          ),
        ),
        // The bottom CTA only exists in unlocked builds — in 1.0.x
        // there's nothing to tap through to, so we just leave the
        // preview standing on its own.
        if (iapUnlocked) ...[
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => openUpsell('quiz_paywall_button'),
              icon: const Icon(Icons.workspace_premium_rounded),
              label: const Text('프리미엄 구독하기'),
            ),
          ),
        ],
      ],
    );
  }
}

class _LockedFeatureCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  const _LockedFeatureCard({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
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
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
            Icon(Icons.lock_outline_rounded, color: AppColors.textHint),
          ],
        ),
      ),
    );
  }
}

class _QuizLauncher extends ConsumerWidget {
  final DailyQuiz quiz;

  /// Tab name forwarded into the quiz session so submit events carry
  /// the right source attribution.
  final String source;

  const _QuizLauncher({required this.quiz, required this.source});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(quizSessionProvider(source));
    final isThisSourceSession = session.quizzes.isNotEmpty;

    if (!isThisSourceSession) {
      return _QuizOverview(
        quiz: quiz,
        onStart: () {
          final unattempted = quiz.quizzes
              .where((q) => !q.isAttempted)
              .toList();
          final toPlay = unattempted.isNotEmpty ? unattempted : quiz.quizzes;
          ref.read(quizSessionProvider(source).notifier).startSession(toPlay);
        },
      );
    }

    if (session.isComplete) {
      return _QuizResults(session: session);
    }

    return _QuizQuestionView(session: session);
  }
}

class _QuizOverview extends StatelessWidget {
  final DailyQuiz quiz;
  final VoidCallback onStart;

  const _QuizOverview({required this.quiz, required this.onStart});

  @override
  Widget build(BuildContext context) {
    final unattempted = quiz.quizzes.where((q) => !q.isAttempted).length;

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
              colors: [Color(0xFF2D2218), Color(0xFF574131)],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '오늘 문장을\n문제로 다시 꺼내보기',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: Colors.white,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                '총 ${quiz.total}문제 중 $unattempted문제가 아직 남아 있어요. 문장을 여러 방식으로 다시 꺼내보며 기억을 고정합니다.',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Colors.white.withValues(alpha: 0.84),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        ...QuizType.values.map((type) {
          final count = quiz.quizzes.where((q) => q.type == type).length;
          if (count == 0) return const SizedBox.shrink();
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Card(
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 6,
                ),
                leading: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(_quizTypeIcon(type), color: AppColors.primary),
                ),
                title: Text(type.displayName),
                subtitle: const Text('문장을 다른 각도에서 다시 떠올리는 문제'),
                trailing: Text(
                  '$count문제',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
            ),
          );
        }),
        const SizedBox(height: 12),
        ElevatedButton(
          onPressed: onStart,
          child: Text(unattempted == quiz.total ? '퀴즈 시작하기' : '남은 퀴즈 이어서 하기'),
        ),
      ],
    );
  }

  IconData _quizTypeIcon(QuizType type) {
    switch (type) {
      case QuizType.fillBlank:
        return Icons.edit_note_rounded;
      case QuizType.wordOrder:
        return Icons.swap_horiz_rounded;
      case QuizType.translation:
        return Icons.translate_rounded;
      case QuizType.multipleChoice:
        return Icons.checklist_rounded;
    }
  }
}

class _QuizQuestionView extends ConsumerStatefulWidget {
  final QuizSessionState session;

  const _QuizQuestionView({required this.session});

  @override
  ConsumerState<_QuizQuestionView> createState() => _QuizQuestionViewState();
}

class _QuizQuestionViewState extends ConsumerState<_QuizQuestionView> {
  QuizResult? _result;
  bool _isSubmitting = false;
  final _textController = TextEditingController();
  List<String> _selectedWords = [];
  List<String> _availableWords = [];
  int? _selectedIndex;

  /// Visual hint toggle for word_to_english / sentence_input modes —
  /// "보기" reveals the partial mask. Reset per quiz so the hint
  /// doesn't carry over.
  bool _showVisualHint = false;

  @override
  void initState() {
    super.initState();
    _textController.addListener(_onTextChanged);
    _initQuiz();
  }

  @override
  void didUpdateWidget(covariant _QuizQuestionView old) {
    super.didUpdateWidget(old);
    if (old.session.currentIndex != widget.session.currentIndex ||
        old.session.currentQuiz?.id != widget.session.currentQuiz?.id) {
      _initQuiz();
    }
  }

  void _initQuiz() {
    _isSubmitting = false;
    _textController.clear();
    _selectedIndex = null;
    _selectedWords = [];
    _showVisualHint = false;
    _result = widget.session.currentIndex < widget.session.results.length
        ? widget.session.results[widget.session.currentIndex]
        : null;

    final quiz = widget.session.currentQuiz;
    if (quiz?.type == QuizType.wordOrder) {
      _availableWords = List<String>.from(quiz!.question['words'] as List);
    }
  }

  @override
  void dispose() {
    _textController.removeListener(_onTextChanged);
    _textController.dispose();
    super.dispose();
  }

  void _onTextChanged() {
    if (!mounted || _result != null) return;
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final quiz = widget.session.currentQuiz;
    if (quiz == null) return const SizedBox.shrink();

    final progress = widget.session.currentIndex + 1;
    final total = widget.session.quizzes.length;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                children: [
                  Row(
                    children: [
                      Text(
                        '$progress / $total',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const Spacer(),
                      if (quiz.difficulty != null) ...[
                        _DifficultyBadge(level: quiz.difficulty!),
                        const SizedBox(width: 8),
                      ],
                      _TypePill(label: _quizLabel(quiz)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: progress / total,
                      minHeight: 10,
                      backgroundColor: AppColors.surfaceLight,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        Expanded(
          // Buttons sit at the bottom of the scrollable area when the
          // keyboard is hidden (so they appear naturally below the
          // explanation card), and pin above the keyboard when it's
          // up (so the user doesn't have to scroll past their own
          // input to reach 제출).
          child: Builder(
            builder: (ctx) {
              final keyboardUp = MediaQuery.viewInsetsOf(ctx).bottom > 0;
              return ListView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                children: [
                  _buildQuizContent(quiz),
                  if (_result?.explanation != null) ...[
                    const SizedBox(height: 12),
                    _ExplanationPanel(
                      explanation: _result!.explanation!,
                      isCorrect: _result!.isCorrect,
                    ),
                  ],
                  if (!keyboardUp) ...[
                    const SizedBox(height: 24),
                    _buildPrimaryActionButton(),
                    if (_result == null && !_isSubmitting) _buildGiveUpButton(),
                    // Bottom breathing room above the system gesture bar.
                    const SizedBox(height: 80),
                  ],
                ],
              );
            },
          ),
        ),
        // Pinned-above-keyboard variant. Only renders while a text
        // field is focused; otherwise the inline buttons inside the
        // ListView take over.
        if (MediaQuery.viewInsetsOf(context).bottom > 0)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildPrimaryActionButton(),
                if (_result == null && !_isSubmitting) _buildGiveUpButton(),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildQuizContent(QuizQuestion quiz) {
    switch (quiz.type) {
      case QuizType.fillBlank:
        return _buildFillBlank(quiz);
      case QuizType.wordOrder:
        return _buildWordOrder(quiz);
      case QuizType.translation:
        return _buildTranslation(quiz);
      case QuizType.multipleChoice:
        return _buildMultipleChoice(quiz);
    }
  }

  Widget _buildFillBlank(QuizQuestion quiz) {
    final mode = quiz.question['mode'] as String?;
    if (mode == 'word_to_english') return _buildWordToEnglish(quiz);
    if (mode == 'sentence_input') return _buildSentenceInput(quiz);

    final sentence = quiz.question['sentence'] as String;
    final hint = quiz.question['hint'] as String?;
    final translation = quiz.question['translation'] as String?;
    final isListening = mode == 'listening';
    // Server includes the un-blanked sentence for TTS playback in
    // listening mode. Falls back to the blanked text (which won't
    // play correctly but won't crash either).
    final fullSentence = (quiz.question['fullSentence'] as String?) ?? sentence;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (isListening) ...[
          // Audio prompt first so the user's eye reads "🔊" before the
          // blanked sentence — encourages listening rather than
          // visual-only guessing.
          _ListeningPrompt(
            word: fullSentence,
            revealedWord: _result != null ? fullSentence : null,
          ),
          const SizedBox(height: 12),
        ],
        _PromptCard(
          title: isListening ? '리스닝 빈칸 채우기' : '빈칸 채우기',
          subtitle: isListening
              ? '문장을 듣고 비어 있는 단어를 채워보세요.'
              : '문장을 다시 완성하면서 핵심 단어를 떠올려보세요.',
          // In listening mode, hide translation — otherwise the user
          // can guess from Korean instead of actually listening.
          child: _SentenceBox(
            primary: sentence,
            secondary: isListening ? null : translation,
          ),
        ),
        // Same reason as translation: in listening mode the meaning-
        // hint trivialises the exercise.
        if (hint != null && !isListening) ...[
          const SizedBox(height: 12),
          _HintBanner(text: '힌트: $hint'),
        ],
        const SizedBox(height: 12),
        TextField(
          controller: _textController,
          enabled: _result == null,
          onSubmitted: (_) {
            if (_canSubmit()) _submit();
          },
          decoration: InputDecoration(
            hintText: '빈칸에 들어갈 단어를 입력하세요',
            suffixIcon: _buildResultIcon(),
          ),
        ),
        if (_result != null && !_result!.isCorrect) ...[
          const SizedBox(height: 12),
          _AnswerBanner(text: '정답: ${_result!.correctAnswer['word']}'),
        ],
      ],
    );
  }

  Widget _buildWordOrder(QuizQuestion quiz) {
    final translation = quiz.question['translation'] as String?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PromptCard(
          title: '단어 배열',
          subtitle: '흩어진 단어를 문장 순서대로 다시 조합해보세요.',
          child: _SentenceBox(primary: translation ?? '올바른 문장 순서를 만들어보세요.'),
        ),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          constraints: const BoxConstraints(minHeight: 88),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surfaceStrong,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: _result == null
                  ? AppColors.border
                  : _result!.isCorrect
                  ? AppColors.success
                  : AppColors.error,
              width: 1.5,
            ),
          ),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _selectedWords.isEmpty
                ? [
                    Text(
                      '아래 단어를 눌러 문장을 만들어보세요.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ]
                : _selectedWords
                      .map(
                        (word) => ActionChip(
                          label: Text(word),
                          onPressed: _result == null
                              ? () => setState(() {
                                  _selectedWords.remove(word);
                                  _availableWords.add(word);
                                })
                              : null,
                        ),
                      )
                      .toList(),
          ),
        ),
        if (_result == null) ...[
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _availableWords
                .map(
                  (word) => ActionChip(
                    label: Text(word),
                    backgroundColor: AppColors.accent,
                    onPressed: () => setState(() {
                      _availableWords.remove(word);
                      _selectedWords.add(word);
                    }),
                  ),
                )
                .toList(),
          ),
        ],
        if (_result != null && !_result!.isCorrect) ...[
          const SizedBox(height: 12),
          _AnswerBanner(
            text:
                '정답: ${(_result!.correctAnswer['correctOrder'] as List).join(' ')}',
          ),
        ],
      ],
    );
  }

  /// 단어퀴즈 (단어장학습 / 완료복습) — show 뜻, user types English.
  /// Two hint toggles: 듣기 (TTS the word) and 보기 (length + first
  /// letter mask). Both can be on simultaneously.
  Widget _buildWordToEnglish(QuizQuestion quiz) {
    final meaning = quiz.question['meaning'] as String;
    final hint = quiz.question['hint'] as Map<String, dynamic>?;
    final audio = hint?['audio'] as String?;
    final visual = hint?['visual'] as Map<String, dynamic>?;
    final visualHint = visual == null
        ? null
        : _maskWord(
            length: visual['length'] as int? ?? 0,
            firstLetter: visual['firstLetter'] as String? ?? '',
          );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PromptCard(
          title: '단어 입력',
          subtitle: '뜻을 보고 영어 단어를 입력하세요.',
          child: _SentenceBox(primary: meaning),
        ),
        const SizedBox(height: 12),
        _HintBar(
          audioText: audio,
          visualHint: _showVisualHint ? visualHint : null,
          onToggleVisual: visualHint == null
              ? null
              : () => setState(() => _showVisualHint = !_showVisualHint),
          isVisualOn: _showVisualHint,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _textController,
          enabled: _result == null,
          autocorrect: false,
          enableSuggestions: false,
          textCapitalization: TextCapitalization.none,
          onSubmitted: (_) {
            if (_canSubmit()) _submit();
          },
          decoration: InputDecoration(
            hintText: '영어 단어',
            suffixIcon: _buildResultIcon(),
          ),
        ),
        if (_result != null && !_result!.isCorrect) ...[
          const SizedBox(height: 12),
          _AnswerBanner(text: '정답: ${_result!.correctAnswer['word']}'),
        ],
      ],
    );
  }

  /// 문장퀴즈 — show translation, user types full English sentence.
  /// Hints: 듣기 (TTS the sentence) + 보기 (~30% pre-filled mask).
  Widget _buildSentenceInput(QuizQuestion quiz) {
    final translation = quiz.question['translation'] as String;
    final hint = quiz.question['hint'] as Map<String, dynamic>?;
    final audio = hint?['audio'] as String?;
    final visualMask = hint?['visual'] as String?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PromptCard(
          title: '문장 입력',
          subtitle: '뜻을 보고 영어 문장을 입력하세요.',
          child: _SentenceBox(primary: translation),
        ),
        const SizedBox(height: 12),
        _HintBar(
          audioText: audio,
          visualHint: _showVisualHint ? visualMask : null,
          onToggleVisual: visualMask == null
              ? null
              : () => setState(() => _showVisualHint = !_showVisualHint),
          isVisualOn: _showVisualHint,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _textController,
          enabled: _result == null,
          autocorrect: false,
          maxLines: 3,
          minLines: 1,
          decoration: InputDecoration(
            hintText: '영어 문장 전체를 입력하세요',
            suffixIcon: _buildResultIcon(),
          ),
        ),
        if (_result != null && !_result!.isCorrect) ...[
          const SizedBox(height: 12),
          _AnswerBanner(
            text:
                '정답: ${_result!.correctAnswer['sentence'] ?? _result!.correctAnswer['fullSentence'] ?? ''}',
          ),
        ],
      ],
    );
  }

  String _maskWord({required int length, required String firstLetter}) {
    if (length <= 0) return '';
    final tail = '_' * (length - 1);
    return '$firstLetter$tail ($length글자)';
  }

  Widget _buildTranslation(QuizQuestion quiz) {
    final translation = quiz.question['translation'] as String;
    final situation = quiz.question['situation'] as String?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PromptCard(
          title: '번역하기',
          subtitle: '한국어 의미를 영어 문장으로 꺼내보세요.',
          child: _SentenceBox(
            primary: translation,
            secondary: situation == null ? null : '상황: $situation',
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _textController,
          enabled: _result == null,
          maxLines: 3,
          decoration: InputDecoration(
            hintText: '영어로 번역하세요',
            suffixIcon: _buildResultIcon(),
          ),
        ),
        if (_result != null && !_result!.isCorrect) ...[
          const SizedBox(height: 12),
          _AnswerBanner(text: '정답: ${_result!.correctAnswer['text']}'),
        ],
      ],
    );
  }

  Widget _buildMultipleChoice(QuizQuestion quiz) {
    final word = quiz.question['word'] as String;
    final contextSentence = quiz.question['context'] as String?;
    final options = List<String>.from(quiz.question['options'] as List);
    final isListening = quiz.question['mode'] == 'listening';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (isListening) ...[
          _ListeningPrompt(
            word: word,
            // Reveal the word after the user answers so they can
            // double-check the spelling against what they thought
            // they heard.
            revealedWord: _result != null ? word : null,
          ),
          const SizedBox(height: 12),
        ],
        _PromptCard(
          title: isListening ? '리스닝 퀴즈' : '객관식',
          subtitle: isListening
              ? '발음을 듣고 어떤 단어의 뜻인지 골라보세요.'
              : '단어 의미를 빠르게 판별해서 기억을 확인합니다.',
          // In listening mode, hide the spelling — show only the
          // context sentence (with the target word masked) so the
          // user has to rely on what they heard, not the visible
          // letters.
          child: isListening
              ? _SentenceBox(
                  primary: '🔊',
                  secondary: contextSentence != null
                      ? _maskWordIn(contextSentence, word)
                      : null,
                )
              : _SentenceBox(primary: word, secondary: contextSentence),
        ),
        const SizedBox(height: 12),
        ...options.asMap().entries.map((entry) {
          final idx = entry.key;
          final option = entry.value;
          final isSelected = _selectedIndex == idx;

          Color fillColor = AppColors.surfaceStrong;
          Color borderColor = AppColors.border;

          if (_result != null) {
            if (idx == _result!.correctAnswer['correctIndex']) {
              fillColor = AppColors.success.withValues(alpha: 0.12);
              borderColor = AppColors.success;
            } else if (isSelected && !_result!.isCorrect) {
              fillColor = AppColors.error.withValues(alpha: 0.10);
              borderColor = AppColors.error;
            }
          } else if (isSelected) {
            fillColor = AppColors.accent;
            borderColor = AppColors.primary;
          }

          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: _result == null
                  ? () => setState(() => _selectedIndex = idx)
                  : null,
              child: Ink(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: fillColor,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: borderColor, width: 1.5),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isSelected
                              ? AppColors.primary
                              : AppColors.textHint,
                          width: 2,
                        ),
                      ),
                      child: isSelected
                          ? Center(
                              child: Container(
                                width: 10,
                                height: 10,
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            )
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        option,
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ],
    );
  }

  /// Replaces every word-boundary occurrence of `target` with a
  /// dashed mask of the same length. Used in listening-mode MC so
  /// the context sentence can still hint at usage without revealing
  /// the spelling.
  String _maskWordIn(String sentence, String target) {
    if (target.isEmpty) return sentence;
    final escaped = RegExp.escape(target);
    final pattern = RegExp('\\b$escaped\\b', caseSensitive: false);
    final mask = '─' * target.length;
    return sentence.replaceAll(pattern, mask);
  }

  Widget? _buildResultIcon() {
    if (_result == null) return null;

    return Icon(
      _result!.isCorrect ? Icons.check_circle_rounded : Icons.cancel_rounded,
      color: _result!.isCorrect ? AppColors.success : AppColors.error,
    );
  }

  /// Type pill 라벨 — quiz.type 만으로는 FILL_BLANK가 다 같은
  /// "빈칸 채우기"로 묶여서 새 모드(word_to_english / sentence_input
  /// / listening)가 구분 안 됨. question.mode를 우선 확인해서
  /// 사용자에게 의미 있는 라벨 표시.
  String _quizLabel(QuizQuestion quiz) {
    final mode = quiz.question['mode'] as String?;
    if (mode == 'word_to_english') return '단어 입력';
    if (mode == 'sentence_input') return '문장 입력';
    if (mode == 'listening') return '리스닝';
    return quiz.type.displayName;
  }

  /// 정답 제출 / 다음 문제 / 결과 보기 버튼. _result 유무로 표시
  /// 라벨이 바뀜. 인라인(스크롤 안)과 키보드 위 핀 두 곳에서 재사용
  /// 되므로 별도 메서드로 추출.
  Widget _buildPrimaryActionButton() {
    return SizedBox(
      width: double.infinity,
      child: _result == null
          ? ElevatedButton(
              onPressed: _canSubmit() && !_isSubmitting ? _submit : null,
              child: _isSubmitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('정답 제출'),
            )
          : ElevatedButton(
              onPressed: () {
                ref
                    .read(quizSessionProvider(widget.session.source).notifier)
                    .nextQuestion();
              },
              child: Text(
                widget.session.currentIndex < widget.session.quizzes.length - 1
                    ? '다음 문제'
                    : '결과 보기',
              ),
            ),
    );
  }

  Widget _buildGiveUpButton() {
    return TextButton(
      onPressed: _giveUp,
      child: Text(
        '모르겠어요 (틀린 걸로 넘어가기)',
        style: TextStyle(color: AppColors.textSecondary),
      ),
    );
  }

  bool _canSubmit() {
    final quiz = widget.session.currentQuiz;
    if (quiz == null || _result != null) return false;

    switch (quiz.type) {
      case QuizType.fillBlank:
      case QuizType.translation:
        return _textController.text.trim().isNotEmpty;
      case QuizType.wordOrder:
        return _selectedWords.isNotEmpty && _availableWords.isEmpty;
      case QuizType.multipleChoice:
        return _selectedIndex != null;
    }
  }

  Future<void> _submit() async {
    final quiz = widget.session.currentQuiz;
    if (quiz == null) return;

    late final Map<String, dynamic> answer;
    switch (quiz.type) {
      case QuizType.fillBlank:
        answer = {'word': _textController.text.trim()};
      case QuizType.wordOrder:
        answer = {'words': _selectedWords};
      case QuizType.translation:
        answer = {'text': _textController.text.trim()};
      case QuizType.multipleChoice:
        answer = {'selectedIndex': _selectedIndex};
    }
    await _send(answer);
  }

  /// "모르겠어요" — send a deliberately empty / out-of-range answer so
  /// the server's checkAnswer marks it wrong, records the attempt, and
  /// the user gets the explanation card + next-question CTA. Lets a
  /// stuck user progress instead of staring at a disabled submit
  /// button.
  Future<void> _giveUp() async {
    final quiz = widget.session.currentQuiz;
    if (quiz == null) return;

    late final Map<String, dynamic> answer;
    switch (quiz.type) {
      case QuizType.fillBlank:
        answer = {'word': ''};
      case QuizType.wordOrder:
        answer = {'words': <String>[]};
      case QuizType.translation:
        answer = {'text': ''};
      case QuizType.multipleChoice:
        // -1 never matches any valid index, so server returns wrong.
        answer = {'selectedIndex': -1};
    }
    await _send(answer);
  }

  Future<void> _send(Map<String, dynamic> answer) async {
    setState(() => _isSubmitting = true);
    try {
      final result = await ref
          .read(quizSessionProvider(widget.session.source).notifier)
          .submitAnswer(answer);
      setState(() {
        _result = result;
        _isSubmitting = false;
      });
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (_isForbidden(e)) {
        ref.read(quizSessionProvider(widget.session.source).notifier).reset();
        await ref.read(authStateProvider.notifier).refreshCurrentUser();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('프리미엄 플랜이 만료되어 퀴즈 제출을 중단했어요.')),
          );
        }
        return;
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('제출 실패: ${friendlyErrorMessage(e)}')),
        );
      }
    }
  }
}

bool _isForbidden(Object error) {
  return error is DioException && error.response?.statusCode == 403;
}

class _QuizResults extends ConsumerWidget {
  final QuizSessionState session;

  const _QuizResults({required this.session});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final total = session.quizzes.length;
    final correct = session.correctCount;
    final percentage = total > 0 ? (correct / total * 100).round() : 0;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
      children: [
        Container(
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(32),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: percentage >= 80
                  ? const [Color(0xFF2F8F5B), Color(0xFF6BC389)]
                  : percentage >= 50
                  ? const [Color(0xFFD38A18), Color(0xFFFFC45B)]
                  : const [Color(0xFFB84A22), Color(0xFFF26B3A)],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                percentage >= 80
                    ? '훌륭해요!'
                    : percentage >= 50
                    ? '잘하고 있어요!'
                    : '한 번 더 돌려볼까요?',
                style: Theme.of(
                  context,
                ).textTheme.headlineMedium?.copyWith(color: Colors.white),
              ),
              const SizedBox(height: 10),
              Text(
                '$total문제 중 $correct문제를 맞췄어요. 오늘 문장을 다시 한 바퀴 돌리면 더 단단해집니다.',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Colors.white.withValues(alpha: 0.84),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                '$percentage%',
                style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  color: Colors.white,
                  fontSize: 40,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _ScoreStat(
                label: '정답',
                count: correct,
                color: AppColors.success,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _ScoreStat(
                label: '오답',
                count: total - correct,
                color: AppColors.error,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _ScoreStat(
                label: '총 문제',
                count: total,
                color: AppColors.primary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: () {
            // Drop the session and refetch every tab's source — the
            // user may have just finished the review queue and we
            // want today's quiz / word quiz to reflect any progress
            // bumps too.
            ref.read(quizSessionProvider(session.source).notifier).reset();
            ref.invalidate(todayQuizProvider);
            ref.invalidate(wordLearningQuizProvider);
            ref.invalidate(wordReviewQuizProvider);
            ref.invalidate(sentenceTypingQuizProvider);
            ref.invalidate(dailyQuizProvider);
            ref.invalidate(reviewQueueProvider);
            ref.invalidate(wordQuizProvider);
            ref.invalidate(wordListeningQuizProvider);
            ref.invalidate(sentenceListeningQuizProvider);
            ref.invalidate(quizProgressProvider);
          },
          child: const Text('퀴즈 화면으로 돌아가기'),
        ),
      ],
    );
  }
}

class _PromptCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final Widget child;

  const _PromptCard({
    required this.title,
    required this.subtitle,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 6),
            Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 16),
            child,
          ],
        ),
      ),
    );
  }
}

class _SentenceBox extends StatelessWidget {
  final String primary;
  final String? secondary;

  const _SentenceBox({required this.primary, this.secondary});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(primary, style: Theme.of(context).textTheme.titleLarge),
          if (secondary != null) ...[
            const SizedBox(height: 10),
            Text(
              secondary!,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}

class _HintBanner extends StatelessWidget {
  final String text;

  const _HintBanner({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.accent,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: AppColors.primaryDark,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _AnswerBanner extends StatelessWidget {
  final String text;

  const _AnswerBanner({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: AppColors.success,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _TypePill extends StatelessWidget {
  final String label;

  const _TypePill({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.accent,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: AppColors.primaryDark,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _ScoreStat extends StatelessWidget {
  final String label;
  final int count;
  final Color color;

  const _ScoreStat({
    required this.label,
    required this.count,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 18),
        child: Column(
          children: [
            Text(
              '$count',
              style: Theme.of(
                context,
              ).textTheme.headlineMedium?.copyWith(color: color),
            ),
            const SizedBox(height: 6),
            Text(label, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

/// Difficulty pill rendered alongside the type pill above each quiz.
/// Color codes match the rest of the app's difficulty palette so the
/// user gets a quick "오 이건 고급이네" cue without reading.
class _DifficultyBadge extends StatelessWidget {
  final String level;
  const _DifficultyBadge({required this.level});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (level) {
      'beginner' => ('초급', AppColors.success),
      'intermediate' => ('중급', AppColors.warning),
      'advanced' => ('고급', AppColors.error),
      _ => (level, AppColors.textSecondary),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.45), width: 1),
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

/// Post-attempt explanation card. Surfaces the full sentence, the
/// Korean translation, every word with its meaning + example, and
/// any grammar notes the content team attached. Stays open until the
/// user moves to the next question — they can scroll it freely.
class _ExplanationPanel extends StatelessWidget {
  final QuizExplanation explanation;
  final bool isCorrect;
  const _ExplanationPanel({required this.explanation, required this.isCorrect});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tintColor = isCorrect ? AppColors.success : AppColors.error;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  isCorrect
                      ? Icons.check_circle_rounded
                      : Icons.lightbulb_outline_rounded,
                  color: tintColor,
                ),
                const SizedBox(width: 8),
                Text(
                  isCorrect ? '잘했어요. 한 번 더 짚고 가기' : '정답과 짚고 가기',
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: tintColor,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (explanation.fullSentence != null) ...[
              Text(
                explanation.fullSentence!,
                style: theme.textTheme.titleLarge,
              ),
              if (explanation.pronunciation != null) ...[
                const SizedBox(height: 4),
                Text(
                  explanation.pronunciation!,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
              if (explanation.translation != null) ...[
                const SizedBox(height: 6),
                Text(
                  explanation.translation!,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ],
            if (explanation.words.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text(
                '주요 단어',
                style: theme.textTheme.titleSmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              ...explanation.words
                  .take(6)
                  .map(
                    (w) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: _WordHintRow(hint: w),
                    ),
                  ),
            ],
            if (explanation.grammarNotes.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                '문법 포인트',
                style: theme.textTheme.titleSmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              ...explanation.grammarNotes.map(
                (g) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _GrammarNoteRow(note: g),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _WordHintRow extends StatelessWidget {
  final QuizWordHint hint;
  const _WordHintRow({required this.hint});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 96,
          child: Text(
            hint.word,
            style: theme.textTheme.bodyLarge?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(hint.meaning, style: theme.textTheme.bodyMedium),
              if (hint.example != null && hint.example!.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  hint.example!,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// Tap-to-play card for the listening quiz. Big speaker button +
/// "다시 듣기" hint. Auto-plays once on first mount so the user can
/// jump straight to the answer if they recognise the word.
/// Two-hint row for the new word/sentence typing quizzes — 듣기
/// triggers TTS, 보기 toggles the visual mask card below. Either hint
/// can be missing (e.g., a quiz without visual mask shows only 듣기).
class _HintBar extends ConsumerWidget {
  final String? audioText;
  final String? visualHint;
  final VoidCallback? onToggleVisual;
  final bool isVisualOn;

  const _HintBar({
    required this.audioText,
    required this.visualHint,
    required this.onToggleVisual,
    required this.isVisualOn,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final buttons = <Widget>[];
    if (audioText != null && audioText!.isNotEmpty) {
      buttons.add(
        OutlinedButton.icon(
          onPressed: () => ref.read(ttsServiceProvider).speak(audioText!),
          icon: const Icon(Icons.volume_up_rounded, size: 18),
          label: const Text('듣기'),
        ),
      );
    }
    if (onToggleVisual != null) {
      buttons.add(
        OutlinedButton.icon(
          onPressed: onToggleVisual,
          icon: Icon(
            isVisualOn
                ? Icons.visibility_off_outlined
                : Icons.visibility_outlined,
            size: 18,
          ),
          label: Text(isVisualOn ? '숨기기' : '보기'),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (buttons.isNotEmpty)
          // Wrap sizes children to their intrinsic widths even when the
          // parent passes loose horizontal constraints, so OutlinedButtons
          // don't hit the `BoxConstraints forces an infinite width`
          // assertion that Row triggers in this layout context.
          Wrap(spacing: 8, runSpacing: 8, children: buttons),
        if (isVisualOn && visualHint != null && visualHint!.isNotEmpty) ...[
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.accent,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              visualHint!,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontFamily: 'monospace',
                color: AppColors.primaryDark,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _ListeningPrompt extends ConsumerStatefulWidget {
  final String word;

  /// Set non-null after the user has answered — reveals the spelling
  /// so they can compare what they heard with how the word is
  /// written.
  final String? revealedWord;

  const _ListeningPrompt({required this.word, this.revealedWord});

  @override
  ConsumerState<_ListeningPrompt> createState() => _ListeningPromptState();
}

class _ListeningPromptState extends ConsumerState<_ListeningPrompt> {
  bool _autoPlayed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_autoPlayed) {
      _autoPlayed = true;
      // Defer so the first frame can render before TTS starts —
      // also gives the iOS audio session a moment to switch into
      // playback category.
      Future.microtask(_play);
    }
  }

  Future<void> _play() async {
    final tts = ref.read(ttsServiceProvider);
    await tts.speak(widget.word);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final revealed = widget.revealedWord;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            ElevatedButton.icon(
              onPressed: _play,
              icon: const Icon(Icons.volume_up_rounded, size: 32),
              label: const Text('다시 듣기'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 28,
                  vertical: 18,
                ),
                textStyle: theme.textTheme.titleMedium,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              '발음을 듣고 어떤 단어인지 떠올려보세요.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            if (revealed != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  revealed,
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: AppColors.primaryDark,
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

class _GrammarNoteRow extends StatelessWidget {
  final QuizGrammarNote note;
  const _GrammarNoteRow({required this.note});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (note.title != null && note.title!.isNotEmpty)
            Text(
              note.title!,
              style: theme.textTheme.titleSmall?.copyWith(
                color: AppColors.primary,
              ),
            ),
          if (note.explanation != null && note.explanation!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(note.explanation!, style: theme.textTheme.bodyMedium),
          ],
          if (note.example != null && note.example!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              note.example!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
