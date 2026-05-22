import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/analytics/analytics_service.dart';
import '../data/quiz_repository.dart';
import 'quiz_model.dart';

final dailyQuizProvider = FutureProvider<DailyQuiz>((ref) async {
  final repo = ref.read(quizRepositoryProvider);
  return repo.getDailyQuiz();
});

final reviewQueueProvider = FutureProvider<DailyQuiz>((ref) async {
  final repo = ref.read(quizRepositoryProvider);
  return repo.getReviewQueue();
});

final wordQuizProvider = FutureProvider<DailyQuiz>((ref) async {
  final repo = ref.read(quizRepositoryProvider);
  return repo.getDailyWordQuiz();
});

final wordListeningQuizProvider = FutureProvider<DailyQuiz>((ref) async {
  final repo = ref.read(quizRepositoryProvider);
  return repo.getDailyWordListeningQuiz();
});

final quizProgressProvider = FutureProvider<QuizProgress>((ref) async {
  final repo = ref.read(quizRepositoryProvider);
  return repo.getProgress();
});

final quizHistoryProvider = FutureProvider<QuizHistory>((ref) async {
  final repo = ref.read(quizRepositoryProvider);
  return repo.getHistory();
});

final quizSessionProvider =
    NotifierProvider<QuizSessionNotifier, QuizSessionState>(
      () => QuizSessionNotifier(),
    );

class QuizSessionState {
  final List<QuizQuestion> quizzes;
  final int currentIndex;
  final List<QuizResult?> results;
  final bool isComplete;
  /// Which tab the session was launched from (`daily` / `review` /
  /// `words` / `listening`). Used for analytics attribution; bare
  /// quiz events would only see quiz type, not which tab generated
  /// them.
  final String source;

  QuizSessionState({
    required this.quizzes,
    this.currentIndex = 0,
    List<QuizResult?>? results,
    this.isComplete = false,
    this.source = 'unknown',
  }) : results = results ?? List.filled(quizzes.length, null);

  QuizQuestion? get currentQuiz =>
      currentIndex < quizzes.length ? quizzes[currentIndex] : null;

  int get correctCount => results.where((r) => r?.isCorrect == true).length;
  int get attemptedCount => results.where((r) => r != null).length;

  QuizSessionState copyWith({
    List<QuizQuestion>? quizzes,
    int? currentIndex,
    List<QuizResult?>? results,
    bool? isComplete,
    String? source,
  }) {
    return QuizSessionState(
      quizzes: quizzes ?? this.quizzes,
      currentIndex: currentIndex ?? this.currentIndex,
      results: results ?? this.results,
      isComplete: isComplete ?? this.isComplete,
      source: source ?? this.source,
    );
  }
}

class QuizSessionNotifier extends Notifier<QuizSessionState> {
  @override
  QuizSessionState build() {
    return QuizSessionState(quizzes: []);
  }

  void startSession(List<QuizQuestion> quizzes, {String source = 'unknown'}) {
    state = QuizSessionState(quizzes: quizzes, source: source);
  }

  Future<QuizResult> submitAnswer(Map<String, dynamic> answer) async {
    final quiz = state.currentQuiz;
    if (quiz == null) throw Exception('No current quiz');

    final repo = ref.read(quizRepositoryProvider);
    final result = await repo.submitAnswer(quiz.id, answer);

    final newResults = [...state.results];
    newResults[state.currentIndex] = result;

    state = state.copyWith(results: newResults);

    // quiz.type carries fill_blank / word_order / translation /
    // multiple_choice. source comes from the active tab.
    ref.read(analyticsServiceProvider).logQuizSubmitted(
          quizType: quiz.type.name,
          source: state.source,
          isCorrect: result.isCorrect,
        );

    return result;
  }

  void nextQuestion() {
    if (state.currentIndex < state.quizzes.length - 1) {
      state = state.copyWith(currentIndex: state.currentIndex + 1);
    } else {
      state = state.copyWith(isComplete: true);
    }
  }
}
