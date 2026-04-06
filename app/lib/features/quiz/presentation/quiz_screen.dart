import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/domain/auth_provider.dart';
import '../../subscription/data/purchase_service.dart';
import '../../subscription/domain/subscription_provider.dart';
import '../domain/quiz_model.dart';
import '../domain/quiz_provider.dart';

class QuizScreen extends ConsumerWidget {
  const QuizScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dailyQuiz = ref.watch(dailyQuizProvider);
    final user = ref.watch(authStateProvider).asData?.value;
    final catalog = ref.watch(purchaseCatalogProvider).asData?.value;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: const Text('문장 퀴즈'),
        actions: [
          IconButton(
            onPressed: () => context.push('/quiz-history'),
            icon: const Icon(Icons.history_rounded),
          ),
        ],
      ),
      body: dailyQuiz.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.error_outline_rounded,
                      size: 48,
                      color: AppColors.error,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      '퀴즈를 불러올 수 없어요',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      error.toString(),
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: () => ref.invalidate(dailyQuizProvider),
                      child: const Text('다시 시도'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        data: (quiz) {
          if (user?.isPremium != true) {
            return _QuizPaywall(
              productPrice: catalog?.premiumProduct?.price,
              canPurchase: catalog?.premiumProduct != null,
              onUpgrade: () async {
                final product = catalog?.premiumProduct;
                if (product == null) return;
                await ref
                    .read(purchaseServiceProvider)
                    .buyPremium(
                      product: product,
                      onSynced: () async {
                        await ref
                            .read(authStateProvider.notifier)
                            .refreshCurrentUser();
                        ref.invalidate(subscriptionStatusProvider);
                        ref.invalidate(dailyQuizProvider);
                      },
                    );
              },
            );
          }

          if (quiz.quizzes.isEmpty) {
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
                          child: const Icon(
                            Icons.school_outlined,
                            color: AppColors.primary,
                            size: 30,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          '아직 생성된 퀴즈가 없어요',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '먼저 오늘의 문장을 보고 발음을 들으면, 그 문장을 기반으로 퀴즈가 준비됩니다.',
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

          return _QuizLauncher(quiz: quiz);
        },
      ),
    );
  }
}

class _QuizPaywall extends StatelessWidget {
  final String? productPrice;
  final bool canPurchase;
  final Future<void> Function() onUpgrade;

  const _QuizPaywall({
    required this.productPrice,
    required this.canPurchase,
    required this.onUpgrade,
  });

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
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: const Icon(
                    Icons.workspace_premium_rounded,
                    color: AppColors.primary,
                    size: 34,
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  '문장 퀴즈는 프리미엄 학습 기능입니다',
                  style: Theme.of(context).textTheme.titleLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  canPurchase
                      ? '월 ${productPrice ?? ''}로 오늘 문장 퀴즈와 퀴즈 푸시를 활성화할 수 있어요.'
                      : '스토어 상품이 아직 연결되지 않았거나 현재 환경에서 결제를 사용할 수 없습니다.',
                  style: Theme.of(context).textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: canPurchase ? onUpgrade : null,
                  child: const Text('프리미엄 구독하기'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _QuizLauncher extends ConsumerWidget {
  final DailyQuiz quiz;

  const _QuizLauncher({required this.quiz});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(quizSessionProvider);

    if (session.quizzes.isEmpty) {
      return _QuizOverview(
        quiz: quiz,
        onStart: () {
          final unattempted = quiz.quizzes
              .where((q) => !q.isAttempted)
              .toList();
          final toPlay = unattempted.isNotEmpty ? unattempted : quiz.quizzes;
          ref.read(quizSessionProvider.notifier).startSession(toPlay);
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

  @override
  void initState() {
    super.initState();
    _initQuiz();
  }

  @override
  void didUpdateWidget(covariant _QuizQuestionView old) {
    super.didUpdateWidget(old);
    if (old.session.currentIndex != widget.session.currentIndex) {
      _initQuiz();
    }
  }

  void _initQuiz() {
    _result = null;
    _isSubmitting = false;
    _textController.clear();
    _selectedIndex = null;
    _selectedWords = [];

    final quiz = widget.session.currentQuiz;
    if (quiz?.type == QuizType.wordOrder) {
      _availableWords = List<String>.from(quiz!.question['words'] as List);
    }
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
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
                      _TypePill(label: quiz.type.displayName),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: progress / total,
                      minHeight: 10,
                      backgroundColor: AppColors.surfaceLight,
                      valueColor: const AlwaysStoppedAnimation<Color>(
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
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            children: [
              _buildQuizContent(quiz),
              if (_result?.explanation != null) ...[
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Text(
                      _result!.explanation!,
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 120),
          child: SizedBox(
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
                      ref.read(quizSessionProvider.notifier).nextQuestion();
                    },
                    child: Text(
                      widget.session.currentIndex <
                              widget.session.quizzes.length - 1
                          ? '다음 문제'
                          : '결과 보기',
                    ),
                  ),
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
    final sentence = quiz.question['sentence'] as String;
    final hint = quiz.question['hint'] as String?;
    final translation = quiz.question['translation'] as String?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PromptCard(
          title: '빈칸 채우기',
          subtitle: '문장을 다시 완성하면서 핵심 단어를 떠올려보세요.',
          child: _SentenceBox(primary: sentence, secondary: translation),
        ),
        if (hint != null) ...[
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PromptCard(
          title: '객관식',
          subtitle: '단어 의미를 빠르게 판별해서 기억을 확인합니다.',
          child: _SentenceBox(primary: word, secondary: contextSentence),
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
                                decoration: const BoxDecoration(
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

  Widget? _buildResultIcon() {
    if (_result == null) return null;

    return Icon(
      _result!.isCorrect ? Icons.check_circle_rounded : Icons.cancel_rounded,
      color: _result!.isCorrect ? AppColors.success : AppColors.error,
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

    setState(() => _isSubmitting = true);

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

    try {
      final result = await ref
          .read(quizSessionProvider.notifier)
          .submitAnswer(answer);
      setState(() {
        _result = result;
        _isSubmitting = false;
      });
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('제출 실패: $e')));
      }
    }
  }
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
            ref.read(quizSessionProvider.notifier).startSession([]);
            ref.invalidate(dailyQuizProvider);
            context.go('/');
          },
          child: const Text('오늘 문장으로 돌아가기'),
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
