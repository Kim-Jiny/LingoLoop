import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/cartoon.dart';
import '../../../core/analytics/analytics_service.dart';
import '../../../core/network/error_message.dart';
import '../../../core/version/version_gate.dart';
import '../../auth/domain/auth_provider.dart';
import '../../language/domain/languages.dart';
import '../../subscription/data/purchase_service.dart';
import '../../subscription/domain/subscription_provider.dart';
import '../../tts/tts_service.dart';
import '../domain/quiz_model.dart';
import '../domain/quiz_provider.dart';
import 'quiz_mic_button.dart';

part 'quiz_locked_preview.dart';
part 'quiz_results.dart';
part 'quiz_widgets.dart';

class QuizScreen extends ConsumerWidget {
  const QuizScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final iapUnlocked = ref.watch(iapUnlockedProvider);

    ref.listen<AsyncValue<PurchaseFailure>>(purchaseErrorsProvider, (
      previous,
      next,
    ) {
      final failure = next.value;
      if (failure == null) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(duration: const Duration(milliseconds: 2200), content: Text(failure.message)));
    });

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
            child: MascotMessage(
              message: friendlyErrorMessage(
                error,
                fallback: '사용자 정보를 확인하지 못했어요.',
              ),
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

        // 배열 퀴즈는 공백 토큰화 기반이라 일본어에선 의미 있는 단어 단위로
        // 분리가 안 됨 (한 문장이 1토큰으로 처리). 형태소 분석기 도입 전까지
        // JA 사용자에겐 탭 자체를 숨김 — 빈 결과만 보고 혼란스러워하지 않게.
        final hideArrange = user.targetLanguage == 'ja';
        return DefaultTabController(
          length: hideArrange ? 3 : 4,
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
              bottom: TabBar(
                isScrollable: true,
                tabs: [
                  const Tab(text: '오늘'),
                  const Tab(text: '단어'),
                  const Tab(text: '문장'),
                  if (!hideArrange) const Tab(text: '배열'),
                ],
              ),
            ),
            body: Column(
              children: [
                Expanded(
                  child: TabBarView(
                    children: [
                      const _QuizTab(
                        source: _QuizSource.today,
                        emptyTitle: '오늘/어제 학습한 문장이 없어요',
                        emptyBody: '오늘 문장을 한 번 풀어보면 여기에 퀴즈가 생깁니다.',
                      ),
                      const _WordTab(),
                      const _QuizTab(
                        source: _QuizSource.sentenceTyping,
                        emptyTitle: '이번 달 완료한 문장이 없어요',
                        emptyBody: '문장을 완료하면 그 달 동안 랜덤으로 다시 풀어볼 수 있어요.',
                      ),
                      if (!hideArrange)
                        const _QuizTab(
                          source: _QuizSource.sentenceArrange,
                          emptyTitle: '학습 완료한 문장이 없어요',
                          emptyBody:
                              '문장을 완료하면 그동안 학습한 모든 문장에서 단어 배열 퀴즈가 생성됩니다.',
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
  sentenceArrange,
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

/// Shared body for each of the three quiz tabs. Picks the right
/// provider based on `source`, then routes through the same
/// `QuizLauncher → quiz session → results` flow.
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
      _QuizSource.sentenceArrange => ref.watch(sentenceArrangeQuizProvider),
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
            case _QuizSource.sentenceArrange:
              ref.invalidate(sentenceArrangeQuizProvider);
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
          // 단어 quiz(wordLearning/wordReview)는 vocabCount가 함께 옴.
          // 단어장은 있는데 quiz가 비어있다 = 오늘 분량 다 풀었다는 뜻.
          // 단어장 자체가 비어있는 경우와 카피를 분리.
          if (quiz.vocabCount != null && quiz.vocabCount! > 0) {
            return _QuizEmptyState(
              title: '오늘 풀 단어가 다 떨어졌어요',
              body:
                  '단어장 ${quiz.vocabCount}개를 모두 한 번씩 맞혀서 오늘 더 풀 단어가 없어요. 내일 다시 만나요!',
            );
          }
          return _QuizEmptyState(title: emptyTitle, body: emptyBody);
        }
        return QuizLauncher(quiz: quiz, source: source.name);
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
  bool _isRestoring = false;

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

  Future<void> _restoreSubscription() async {
    setState(() => _isRestoring = true);
    try {
      await _restoreSubscriptionFromStore(ref, source: widget.source);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(duration: Duration(milliseconds: 2200), content: Text('구독 상태를 확인하고 있어요.')));
      }
      widget.onRetry();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(duration: const Duration(milliseconds: 2200), 
            content: Text(
              friendlyErrorMessage(e, fallback: '구독 상태 확인에 실패했어요.'),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isRestoring = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isForbidden = _isForbidden(widget.error);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: CartoonCard(
          padding: EdgeInsets.zero,
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
                  onPressed: _isRestoring
                      ? null
                      : isForbidden
                      ? _restoreSubscription
                      : widget.onRetry,
                  child: Text(isForbidden ? '구독 상태 다시 확인' : '다시 시도'),
                ),
                if (isForbidden) ...[
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _isRestoring
                        ? null
                        : () => context.push('/subscription'),
                    child: const Text('구독 화면으로 이동'),
                  ),
                ],
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
        child: CartoonCard(
          padding: EdgeInsets.zero,
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

class QuizLauncher extends ConsumerWidget {
  final DailyQuiz quiz;

  /// Tab name forwarded into the quiz session so submit events carry
  /// the right source attribution.
  final String source;

  const QuizLauncher({super.key, required this.quiz, required this.source});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(quizSessionProvider(source));
    final isThisSourceSession = session.quizzes.isNotEmpty;

    if (!isThisSourceSession) {
      return QuizOverview(
        quiz: quiz,
        source: source,
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
      return QuizResults(session: session);
    }

    return QuizQuestionView(session: session);
  }
}

class QuizOverview extends ConsumerWidget {
  final DailyQuiz quiz;

  /// _QuizSource.name 값 — QuizLauncher가 string으로 넘기는 형태
  /// (quizSessionProvider key 호환). overview 헤더 분기에만 사용.
  final String source;
  final VoidCallback onStart;

  const QuizOverview({
    super.key,
    required this.quiz,
    required this.source,
    required this.onStart,
  });

  /// source별 헤더/본문 카피. 다언어 — '영어' 부분을 사용자의 현재
  /// 학습 언어 라벨(영어/일본어)로 동적 치환. 이전엔 모든 모드가 "오늘
  /// 문장을 다시 꺼내보기"로 고정돼 단어/문장 입력 모드에 사실과 안 맞는
  /// 안내를 띄웠음.
  ({String title, String body}) _copy(String langLabel) {
    switch (source) {
      case 'today':
        return (
          title: '오늘 문장을\n다시 꺼내보기',
          body: '빈칸·어순·번역·객관식으로 다시 풀어보며 기억을 단단하게 만들어요.',
        );
      case 'wordLearning':
        return (
          title: '단어장 단어를\n$langLabel(으)로 입력해보기',
          body:
              '학습 중인 단어를 뜻만 보고 $langLabel(으)로 입력합니다. 단어장에 새 단어가 쌓일수록 풀 수 있는 문제가 늘어나요.',
        );
      case 'wordReview':
        return (
          title: '학습 완료 단어\n다시 떠올리기',
          body: '"완료"로 옮긴 단어를 다시 입력하며 잊지 않도록 점검합니다.',
        );
      case 'sentenceTyping':
        return (
          title: '이번 달 완료한 문장\n직접 입력해보기',
          body: '이번 달 학습 완료한 문장 중 랜덤으로 뽑아 한글 뜻을 보고 $langLabel 문장을 직접 입력합니다.',
        );
      case 'sentenceArrange':
        return (
          title: '단어 순서를 배열해\n문장 완성하기',
          body: '그동안 학습 완료한 모든 문장 중 랜덤으로 뽑아 흩어진 단어 버튼을 순서대로 눌러 문장을 만듭니다.',
        );
      case 'listening':
        return (
          title: '단어 발음 듣고\n뜻 고르기',
          body: '단어장의 단어 발음을 듣고 알맞은 뜻을 4지 선다로 고릅니다.',
        );
      case 'sentenceListening':
        return (title: '문장 듣고\n빈칸 채우기', body: '최근 학습한 문장을 듣고 비어있는 단어를 입력합니다.');
      case 'sentenceReview':
        return (
          title: '오늘 문장\n다시 풀어보기',
          body: '이 문장에 대한 빈칸·어순·번역·객관식 문제를 풀어보세요.',
        );
      default:
        return (title: '퀴즈 시작하기', body: '준비된 문제로 학습을 이어가세요.');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unattempted = quiz.quizzes.where((q) => !q.isAttempted).length;
    final user = ref.watch(authStateProvider).asData?.value;
    final langCode = user?.targetLanguage ?? 'en';
    final langLabel = findLanguage(langCode)?.labelKo ?? '영어';
    final copy = _copy(langLabel);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
      children: [
        CartoonCard(
          color: AppColors.accent,
          padding: const EdgeInsets.all(24),
          radius: 28,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  BounceIn(
                    child: const Mascot(mood: MascotMood.think, size: 56),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      copy.title,
                      style: Theme.of(
                        context,
                      ).textTheme.headlineSmall?.copyWith(height: 1.25),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                '${copy.body}\n\n${quiz.total}문제가 준비되어 있어요.',
                style: Theme.of(context).textTheme.bodyLarge,
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
            child: CartoonCard(
              padding: EdgeInsets.zero,
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
                title: Text(
                  type.displayName,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                subtitle: Text(_typeHint(type)),
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

  /// 유형별 한 줄 설명. 4개가 똑같은 문구면 정보가 없고, 긴 문구는 글자
  /// 중간에서 줄바꿈되므로 짧게 둔다.
  String _typeHint(QuizType type) {
    switch (type) {
      case QuizType.fillBlank:
        return '빈칸에 들어갈 단어 입력';
      case QuizType.wordOrder:
        return '흩어진 단어를 순서대로';
      case QuizType.translation:
        return '뜻을 보고 문장 입력';
      case QuizType.multipleChoice:
        return '알맞은 뜻 고르기';
    }
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

class QuizQuestionView extends ConsumerStatefulWidget {
  final QuizSessionState session;

  const QuizQuestionView({super.key, required this.session});

  @override
  ConsumerState<QuizQuestionView> createState() => QuizQuestionViewState();
}

class QuizQuestionViewState extends ConsumerState<QuizQuestionView> {
  QuizResult? _result;
  bool _isSubmitting = false;
  final _textController = TextEditingController();

  /// wordOrder 퀴즈: 흩어진 단어 원본(고정, 위치 불변).
  List<String> _orderWords = [];

  /// 선택한 단어들의 [_orderWords] 인덱스 목록(탭한 순서). 같은 단어가
  /// 여러 번 나와도 인덱스로 구분하므로 위치가 흔들리지 않는다.
  List<int> _selectedOrder = [];
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
  void didUpdateWidget(covariant QuizQuestionView old) {
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
    _selectedOrder = [];
    _showVisualHint = false;
    _result = widget.session.currentIndex < widget.session.results.length
        ? widget.session.results[widget.session.currentIndex]
        : null;

    final quiz = widget.session.currentQuiz;
    if (quiz?.type == QuizType.wordOrder) {
      _orderWords = List<String>.from(quiz!.question['words'] as List);
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
          child: CartoonCard(
            padding: EdgeInsets.zero,
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
                    // 정답이면 톡 튀어 나타나고, 오답이면 한 번 살짝 흔들린다.
                    // key로 문제/결과가 바뀔 때마다 다시 재생.
                    KeyedSubtree(
                      key: ValueKey('result-${quiz.id}-${_result!.isCorrect}'),
                      child: _result!.isCorrect
                          ? BounceIn(
                              child: _ExplanationPanel(
                                explanation: _result!.explanation!,
                                isCorrect: true,
                              ),
                            )
                          : ShakeOnce(
                              child: _ExplanationPanel(
                                explanation: _result!.explanation!,
                                isCorrect: false,
                              ),
                            ),
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
            suffixIcon: _buildInputSuffix(),
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
            children: _selectedOrder.isEmpty
                ? [
                    Text(
                      '아래 단어를 눌러 문장을 만들어보세요.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ]
                : _selectedOrder
                      .map(
                        (i) => ActionChip(
                          label: Text(_orderWords[i]),
                          onPressed: _result == null
                              ? () => setState(() {
                                  _selectedOrder.remove(i);
                                })
                              : null,
                        ),
                      )
                      .toList(),
          ),
        ),
        if (_result == null) ...[
          const SizedBox(height: 16),
          // 단어 원본을 항상 고정 위치로 렌더링한다. 이미 선택한 단어는
          // 사라지지 않고 딤 처리 + 비활성화되어 레이아웃이 흔들리지 않는다.
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: List.generate(_orderWords.length, (i) {
              final used = _selectedOrder.contains(i);
              return Opacity(
                opacity: used ? 0.35 : 1,
                child: ActionChip(
                  label: Text(_orderWords[i]),
                  backgroundColor: AppColors.accent,
                  onPressed: used
                      ? null
                      : () => setState(() {
                          _selectedOrder.add(i);
                        }),
                ),
              );
            }),
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
          subtitle: '뜻을 보고 ${_targetLangLabel()} 단어를 입력하세요.',
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
            hintText: '${_targetLangLabel()} 단어',
            suffixIcon: _buildInputSuffix(),
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
          subtitle: '뜻을 보고 ${_targetLangLabel()} 문장을 입력하세요.',
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
            hintText: '${_targetLangLabel()} 문장 전체를 입력하세요',
            suffixIcon: _buildInputSuffix(),
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

  /// 현재 학습 언어의 한국어 라벨. 퀴즈 prompt/hint에 "영어로/일본어로"
  /// 같은 동적 텍스트를 넣을 때 사용. 캐시 안 함 — 사용자가 도중에 언어를
  /// 바꿔도 ref.watch가 자동 갱신.
  String _targetLangLabel() {
    final code = ref.watch(authStateProvider).asData?.value?.targetLanguage;
    return findLanguage(code ?? 'en')?.labelKo ?? '영어';
  }

  Widget _buildTranslation(QuizQuestion quiz) {
    final translation = quiz.question['translation'] as String;
    final situation = quiz.question['situation'] as String?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PromptCard(
          title: '번역하기',
          subtitle: '한국어 의미를 ${_targetLangLabel()} 문장으로 꺼내보세요.',
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
            hintText: '${_targetLangLabel()}(으)로 번역하세요',
            suffixIcon: _buildInputSuffix(),
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
                  primary: '',
                  leading: const CuteIcon(CuteKind.speaker, size: 40),
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
          Color borderColor = AppColors.textPrimary.withValues(alpha: 0.4);

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
                  border: Border.all(color: borderColor, width: 2),
                ),
                child: Row(
                  children: [
                    if (_result != null &&
                        idx == _result!.correctAnswer['correctIndex'])
                      Icon(
                        Icons.check_circle_rounded,
                        size: 24,
                        color: AppColors.success,
                      )
                    else if (_result != null && isSelected)
                      Icon(
                        Icons.cancel_rounded,
                        size: 24,
                        color: AppColors.error,
                      )
                    else
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

    return BounceIn(
      key: ValueKey('icon-${_result!.isCorrect}'),
      child: Icon(
        _result!.isCorrect ? Icons.check_circle_rounded : Icons.cancel_rounded,
        color: _result!.isCorrect ? AppColors.success : AppColors.error,
      ),
    );
  }

  /// TextField suffix — 정답 제출 전이면 마이크(음성 입력), 제출 후엔
  /// O/X 아이콘. 한 슬롯이라 둘 다 동시에 못 띄움.
  Widget? _buildInputSuffix() {
    if (_result != null) return _buildResultIcon();
    return QuizMicButton(controller: _textController, enabled: !_isSubmitting);
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
    return Column(
      children: [
        TextButton(
          onPressed: _giveUp,
          child: Text(
            '모르겠어요 (틀린 걸로 넘어가기)',
            style: TextStyle(color: AppColors.textSecondary),
          ),
        ),
        TextButton(
          onPressed: _finishEarly,
          child: Text(
            '여기까지 풀기',
            style: TextStyle(color: AppColors.textSecondary),
          ),
        ),
      ],
    );
  }

  /// "여기까지 풀기" — 도중 종료. 현재 문제는 attempt 기록 안 하고
  /// 그동안 푼 것만 가지고 결과 화면으로. attempted 0이면 그냥 quiz
  /// 시작화면으로 reset.
  Future<void> _finishEarly() async {
    final attempted = widget.session.attemptedCount;
    if (attempted == 0) {
      // 한 문제도 안 풀었으면 굳이 결과 화면 거치지 말고 그냥 quiz
      // 시작화면으로 돌아감 — 0/0 결과는 의미 없음.
      ref.read(quizSessionProvider(widget.session.source).notifier).reset();
      return;
    }
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('여기까지 풀고 결과 볼까요?'),
        content: Text('$attempted문제를 푼 결과를 보여드릴게요. 남은 문제는 다음에 다시 만날 수 있어요.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('계속 풀기'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('결과 보기'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    ref.read(quizSessionProvider(widget.session.source).notifier).finishEarly();
  }

  bool _canSubmit() {
    final quiz = widget.session.currentQuiz;
    if (quiz == null || _result != null || _isSubmitting) return false;

    switch (quiz.type) {
      case QuizType.fillBlank:
      case QuizType.translation:
        return _textController.text.trim().isNotEmpty;
      case QuizType.wordOrder:
        return _orderWords.isNotEmpty &&
            _selectedOrder.length == _orderWords.length;
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
        answer = {'words': _selectedOrder.map((i) => _orderWords[i]).toList()};
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
      // 제출 중 탭 전환/세션 reset으로 위젯이 사라졌을 수 있다.
      if (!mounted) return;
      // 색만으로 정오답이 전달되지 않도록 촉각 피드백도 준다.
      if (result.isCorrect) {
        HapticFeedback.lightImpact();
      } else {
        HapticFeedback.mediumImpact();
      }
      setState(() {
        _result = result;
        _isSubmitting = false;
      });
    } catch (e) {
      if (mounted) setState(() => _isSubmitting = false);
      if (_isForbidden(e)) {
        ref.read(quizSessionProvider(widget.session.source).notifier).reset();
        await _restoreSubscriptionFromStore(ref, source: widget.session.source);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(duration: Duration(milliseconds: 2200), content: Text('프리미엄 플랜이 만료되어 퀴즈 제출을 중단했어요.')),
          );
        }
        return;
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(duration: const Duration(milliseconds: 2200), content: Text('제출 실패: ${friendlyErrorMessage(e)}')),
        );
      }
    }
  }
}

bool _isForbidden(Object error) {
  return error is DioException && error.response?.statusCode == 403;
}

Future<void> _restoreSubscriptionFromStore(
  WidgetRef ref, {
  String? source,
}) async {
  if (source != null) {
    ref.read(quizSessionProvider(source).notifier).reset();
  }

  Future<void> syncServerState() async {
    ref.invalidate(subscriptionStatusProvider);
    await ref.read(authStateProvider.notifier).refreshCurrentUser();
  }

  try {
    await ref
        .read(purchaseServiceProvider)
        .restorePurchases(onSynced: syncServerState);
  } finally {
    await syncServerState();
  }
}
