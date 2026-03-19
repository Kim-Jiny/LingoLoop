import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../domain/quiz_model.dart';
import '../domain/quiz_provider.dart';

class QuizScreen extends ConsumerWidget {
  const QuizScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dailyQuiz = ref.watch(dailyQuizProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('오늘의 퀴즈'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: dailyQuiz.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.error),
              const SizedBox(height: 16),
              Text('퀴즈를 불러올 수 없습니다',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => ref.invalidate(dailyQuizProvider),
                child: const Text('다시 시도'),
              ),
            ],
          ),
        ),
        data: (quiz) {
          if (quiz.quizzes.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.school_outlined,
                        size: 64, color: AppColors.textHint),
                    const SizedBox(height: 16),
                    Text('퀴즈가 없습니다',
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 8),
                    Text(
                      '먼저 오늘의 문장을 학습하면\n퀴즈가 생성됩니다.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 15,
                      ),
                    ),
                  ],
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

class _QuizLauncher extends ConsumerWidget {
  final DailyQuiz quiz;
  const _QuizLauncher({required this.quiz});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(quizSessionProvider);

    // If session not started, show quiz overview
    if (session.quizzes.isEmpty) {
      return _QuizOverview(
        quiz: quiz,
        onStart: () {
          final unattempted =
              quiz.quizzes.where((q) => !q.isAttempted).toList();
          final toPlay = unattempted.isNotEmpty ? unattempted : quiz.quizzes;
          ref.read(quizSessionProvider.notifier).startSession(toPlay);
        },
      );
    }

    // If complete, show results
    if (session.isComplete) {
      return _QuizResults(session: session);
    }

    // Show current quiz question
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

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 40),
          const Icon(Icons.quiz_outlined, size: 72, color: AppColors.primary),
          const SizedBox(height: 24),
          Text('오늘의 퀴즈', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 12),
          Text(
            '총 ${quiz.total}문제 중 $unattempted문제 남음',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 32),

          // Quiz type breakdown
          ...QuizType.values.map((type) {
            final count =
                quiz.quizzes.where((q) => q.type == type).length;
            if (count == 0) return const SizedBox.shrink();
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Icon(_quizTypeIcon(type),
                      size: 20, color: AppColors.textSecondary),
                  const SizedBox(width: 12),
                  Text(type.displayName,
                      style: const TextStyle(fontSize: 15)),
                  const Spacer(),
                  Text('$count문제',
                      style: TextStyle(color: AppColors.textSecondary)),
                ],
              ),
            );
          }),

          const Spacer(),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: onStart,
              child: Text(unattempted == quiz.total
                  ? '퀴즈 시작'
                  : '남은 퀴즈 풀기'),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  IconData _quizTypeIcon(QuizType type) {
    switch (type) {
      case QuizType.fillBlank:
        return Icons.edit_note;
      case QuizType.wordOrder:
        return Icons.swap_horiz;
      case QuizType.translation:
        return Icons.translate;
      case QuizType.multipleChoice:
        return Icons.checklist;
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

  // For fill_blank & translation
  final _textController = TextEditingController();

  // For word_order
  List<String> _selectedWords = [];
  List<String> _availableWords = [];

  // For multiple_choice
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
      _availableWords =
          List<String>.from(quiz!.question['words'] as List);
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
        // Progress bar
        LinearProgressIndicator(
          value: progress / total,
          backgroundColor: AppColors.surfaceLight,
          valueColor:
              const AlwaysStoppedAnimation<Color>(AppColors.primary),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Row(
            children: [
              Text('$progress / $total',
                  style: TextStyle(
                      color: AppColors.textSecondary, fontSize: 13)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primaryLight.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  quiz.type.displayName,
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),

        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: _buildQuizContent(quiz),
          ),
        ),

        // Submit / Next button
        Padding(
          padding: const EdgeInsets.all(20),
          child: SizedBox(
            width: double.infinity,
            height: 52,
            child: _result == null
                ? ElevatedButton(
                    onPressed: _canSubmit() && !_isSubmitting
                        ? _submit
                        : null,
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('제출하기'),
                  )
                : ElevatedButton(
                    onPressed: () {
                      ref.read(quizSessionProvider.notifier).nextQuestion();
                    },
                    child: Text(
                        widget.session.currentIndex <
                                widget.session.quizzes.length - 1
                            ? '다음 문제'
                            : '결과 보기'),
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
        const Text('빈칸에 들어갈 단어를 입력하세요',
            style: TextStyle(fontSize: 15, color: AppColors.textSecondary)),
        const SizedBox(height: 20),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  sentence,
                  style: const TextStyle(fontSize: 20, height: 1.5),
                ),
                if (translation != null) ...[
                  const SizedBox(height: 12),
                  Text(translation,
                      style: TextStyle(
                          color: AppColors.textSecondary, fontSize: 14)),
                ],
              ],
            ),
          ),
        ),
        if (hint != null) ...[
          const SizedBox(height: 12),
          Text('힌트: $hint',
              style: TextStyle(
                  color: AppColors.primary,
                  fontStyle: FontStyle.italic,
                  fontSize: 14)),
        ],
        const SizedBox(height: 20),
        TextField(
          controller: _textController,
          enabled: _result == null,
          decoration: InputDecoration(
            hintText: '답을 입력하세요',
            border: const OutlineInputBorder(),
            suffixIcon: _result != null
                ? Icon(
                    _result!.isCorrect ? Icons.check_circle : Icons.cancel,
                    color: _result!.isCorrect
                        ? AppColors.success
                        : AppColors.error,
                  )
                : null,
          ),
          onSubmitted: (_) {
            if (_canSubmit()) _submit();
          },
        ),
        if (_result != null && !_result!.isCorrect) ...[
          const SizedBox(height: 12),
          Text(
            '정답: ${_result!.correctAnswer['word']}',
            style: const TextStyle(
                color: AppColors.success,
                fontWeight: FontWeight.w600,
                fontSize: 15),
          ),
        ],
      ],
    );
  }

  Widget _buildWordOrder(QuizQuestion quiz) {
    final translation = quiz.question['translation'] as String?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('단어를 올바른 순서로 배열하세요',
            style: TextStyle(fontSize: 15, color: AppColors.textSecondary)),
        const SizedBox(height: 16),
        if (translation != null)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(translation,
                  style: const TextStyle(fontSize: 16)),
            ),
          ),
        const SizedBox(height: 20),

        // Selected words area
        Container(
          width: double.infinity,
          constraints: const BoxConstraints(minHeight: 60),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border.all(
              color: _result == null
                  ? AppColors.textHint
                  : _result!.isCorrect
                      ? AppColors.success
                      : AppColors.error,
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _selectedWords
                .map((word) => ActionChip(
                      label: Text(word),
                      onPressed: _result == null
                          ? () => setState(() {
                                _selectedWords.remove(word);
                                _availableWords.add(word);
                              })
                          : null,
                    ))
                .toList(),
          ),
        ),
        const SizedBox(height: 16),

        // Available words
        if (_result == null)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _availableWords
                .map((word) => ActionChip(
                      label: Text(word),
                      backgroundColor: AppColors.primaryLight
                          .withValues(alpha: 0.15),
                      onPressed: () => setState(() {
                        _availableWords.remove(word);
                        _selectedWords.add(word);
                      }),
                    ))
                .toList(),
          ),

        if (_result != null && !_result!.isCorrect) ...[
          const SizedBox(height: 16),
          Text(
            '정답: ${(_result!.correctAnswer['correctOrder'] as List).join(' ')}',
            style: const TextStyle(
                color: AppColors.success,
                fontWeight: FontWeight.w600,
                fontSize: 15),
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
        const Text('한국어를 영어로 번역하세요',
            style: TextStyle(fontSize: 15, color: AppColors.textSecondary)),
        const SizedBox(height: 20),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  translation,
                  style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                      height: 1.4),
                ),
                if (situation != null) ...[
                  const SizedBox(height: 10),
                  Text('상황: $situation',
                      style: TextStyle(
                          color: AppColors.textHint,
                          fontSize: 13,
                          fontStyle: FontStyle.italic)),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _textController,
          enabled: _result == null,
          maxLines: 3,
          decoration: InputDecoration(
            hintText: '영어로 번역하세요',
            border: const OutlineInputBorder(),
            suffixIcon: _result != null
                ? Icon(
                    _result!.isCorrect ? Icons.check_circle : Icons.cancel,
                    color: _result!.isCorrect
                        ? AppColors.success
                        : AppColors.error,
                  )
                : null,
          ),
        ),
        if (_result != null && !_result!.isCorrect) ...[
          const SizedBox(height: 12),
          Text(
            '정답: ${_result!.correctAnswer['text']}',
            style: const TextStyle(
                color: AppColors.success,
                fontWeight: FontWeight.w600,
                fontSize: 15),
          ),
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
        const Text('단어의 뜻을 고르세요',
            style: TextStyle(fontSize: 15, color: AppColors.textSecondary)),
        const SizedBox(height: 20),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  word,
                  style: const TextStyle(
                      fontSize: 24, fontWeight: FontWeight.bold),
                ),
                if (contextSentence != null) ...[
                  const SizedBox(height: 10),
                  Text(contextSentence,
                      style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 14,
                          fontStyle: FontStyle.italic)),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        ...options.asMap().entries.map((entry) {
          final idx = entry.key;
          final option = entry.value;
          final isSelected = _selectedIndex == idx;

          Color? tileColor;
          if (_result != null) {
            if (idx == _result!.correctAnswer['correctIndex']) {
              tileColor = AppColors.success.withValues(alpha: 0.1);
            } else if (isSelected && !_result!.isCorrect) {
              tileColor = AppColors.error.withValues(alpha: 0.1);
            }
          }

          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                  color: isSelected && _result == null
                      ? AppColors.primary
                      : AppColors.surfaceLight,
                  width: isSelected && _result == null ? 2 : 1,
                ),
              ),
              tileColor: tileColor,
              title: Text(option),
              leading: Radio<int>(
                value: idx,
                groupValue: _selectedIndex,
                onChanged: _result == null
                    ? (val) => setState(() => _selectedIndex = val)
                    : null,
              ),
              onTap: _result == null
                  ? () => setState(() => _selectedIndex = idx)
                  : null,
            ),
          );
        }),
      ],
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

    Map<String, dynamic> answer;
    switch (quiz.type) {
      case QuizType.fillBlank:
        answer = {'word': _textController.text.trim()};
        break;
      case QuizType.wordOrder:
        answer = {'words': _selectedWords};
        break;
      case QuizType.translation:
        answer = {'text': _textController.text.trim()};
        break;
      case QuizType.multipleChoice:
        answer = {'selectedIndex': _selectedIndex};
        break;
    }

    try {
      final result =
          await ref.read(quizSessionProvider.notifier).submitAnswer(answer);
      setState(() {
        _result = result;
        _isSubmitting = false;
      });
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('제출 실패: $e')),
        );
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

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 40),
          Icon(
            percentage >= 80
                ? Icons.emoji_events
                : percentage >= 50
                    ? Icons.thumb_up
                    : Icons.school,
            size: 72,
            color: percentage >= 80
                ? AppColors.warning
                : percentage >= 50
                    ? AppColors.success
                    : AppColors.primary,
          ),
          const SizedBox(height: 24),
          Text(
            percentage >= 80
                ? '훌륭해요!'
                : percentage >= 50
                    ? '잘했어요!'
                    : '다시 도전해봐요!',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 16),
          Text(
            '$total문제 중 $correct문제 정답 ($percentage%)',
            style: TextStyle(
                color: AppColors.textSecondary, fontSize: 17),
          ),
          const SizedBox(height: 32),

          // Score breakdown
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _ScoreStat(
                  label: '정답',
                  count: correct,
                  color: AppColors.success),
              _ScoreStat(
                  label: '오답',
                  count: total - correct,
                  color: AppColors.error),
              _ScoreStat(
                  label: '총 문제',
                  count: total,
                  color: AppColors.primary),
            ],
          ),
          const Spacer(),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: () {
                ref.read(quizSessionProvider.notifier).startSession([]);
                ref.invalidate(dailyQuizProvider);
                context.pop();
              },
              child: const Text('완료'),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _ScoreStat extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  const _ScoreStat(
      {required this.label, required this.count, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          '$count',
          style: TextStyle(
              fontSize: 28, fontWeight: FontWeight.bold, color: color),
        ),
        const SizedBox(height: 4),
        Text(label,
            style: TextStyle(
                color: AppColors.textSecondary, fontSize: 13)),
      ],
    );
  }
}
