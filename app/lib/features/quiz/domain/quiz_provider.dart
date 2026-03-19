import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/quiz_repository.dart';
import 'quiz_model.dart';

final dailyQuizProvider = FutureProvider<DailyQuiz>((ref) async {
  final repo = ref.read(quizRepositoryProvider);
  return repo.getDailyQuiz();
});

final quizSessionProvider =
    NotifierProvider<QuizSessionNotifier, QuizSessionState>(
        () => QuizSessionNotifier());

class QuizSessionState {
  final List<QuizQuestion> quizzes;
  final int currentIndex;
  final List<QuizResult?> results;
  final bool isComplete;

  QuizSessionState({
    required this.quizzes,
    this.currentIndex = 0,
    List<QuizResult?>? results,
    this.isComplete = false,
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
  }) {
    return QuizSessionState(
      quizzes: quizzes ?? this.quizzes,
      currentIndex: currentIndex ?? this.currentIndex,
      results: results ?? this.results,
      isComplete: isComplete ?? this.isComplete,
    );
  }
}

class QuizSessionNotifier extends Notifier<QuizSessionState> {
  @override
  QuizSessionState build() {
    return QuizSessionState(quizzes: []);
  }

  void startSession(List<QuizQuestion> quizzes) {
    state = QuizSessionState(quizzes: quizzes);
  }

  Future<QuizResult> submitAnswer(Map<String, dynamic> answer) async {
    final quiz = state.currentQuiz;
    if (quiz == null) throw Exception('No current quiz');

    final repo = ref.read(quizRepositoryProvider);
    final result = await repo.submitAnswer(quiz.id, answer);

    final newResults = [...state.results];
    newResults[state.currentIndex] = result;

    state = state.copyWith(results: newResults);
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
