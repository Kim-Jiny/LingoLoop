import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/analytics/analytics_service.dart';
import '../../../core/review/review_prompt_service.dart';
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

final sentenceListeningQuizProvider = FutureProvider<DailyQuiz>((ref) async {
  final repo = ref.read(quizRepositoryProvider);
  return repo.getDailySentenceListeningQuiz();
});

// 2026-05 redesign — narrower today + typed word/sentence quizzes.
final todayQuizProvider = FutureProvider<DailyQuiz>((ref) async {
  final repo = ref.read(quizRepositoryProvider);
  return repo.getTodayQuiz();
});

final wordLearningQuizProvider = FutureProvider<DailyQuiz>((ref) async {
  final repo = ref.read(quizRepositoryProvider);
  return repo.getWordLearningQuiz();
});

final wordReviewQuizProvider = FutureProvider<DailyQuiz>((ref) async {
  final repo = ref.read(quizRepositoryProvider);
  return repo.getWordReviewQuiz();
});

final sentenceTypingQuizProvider = FutureProvider<DailyQuiz>((ref) async {
  final repo = ref.read(quizRepositoryProvider);
  return repo.getSentenceTypingQuiz();
});

final sentenceArrangeQuizProvider = FutureProvider<DailyQuiz>((ref) async {
  final repo = ref.read(quizRepositoryProvider);
  return repo.getSentenceArrangeQuiz();
});

final quizProgressProvider = FutureProvider<QuizProgress>((ref) async {
  final repo = ref.read(quizRepositoryProvider);
  return repo.getProgress();
});

/// quiz 기록 — category별로 fetch (각 quiz tab과 매핑). family param에
/// null/'all' 넘기면 전체, 그 외엔 서버 whitelist에 따라 filter.
final quizHistoryProvider =
    FutureProvider.family<QuizHistory, String?>((ref, category) async {
  final repo = ref.read(quizRepositoryProvider);
  return repo.getHistory(category: category);
});

final quizSessionProvider =
    NotifierProvider.family<QuizSessionNotifier, QuizSessionState, String>(
      (source) => QuizSessionNotifier(source),
    );

class QuizSessionState {
  final List<QuizQuestion> quizzes;
  final int currentIndex;
  final List<QuizResult?> results;
  final bool isComplete;
  /// "여기까지 풀기"로 끝낸 경우 true. 결과 화면이 attemptedCount를
  /// 기준으로 정답률을 계산할지(true) 전체 quizzes 기준으로 할지(false)
  /// 결정.
  final bool finishedEarly;

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
    this.finishedEarly = false,
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
    bool? finishedEarly,
    String? source,
  }) {
    return QuizSessionState(
      quizzes: quizzes ?? this.quizzes,
      currentIndex: currentIndex ?? this.currentIndex,
      results: results ?? this.results,
      isComplete: isComplete ?? this.isComplete,
      finishedEarly: finishedEarly ?? this.finishedEarly,
      source: source ?? this.source,
    );
  }
}

class QuizSessionNotifier extends Notifier<QuizSessionState> {
  final String _source;

  QuizSessionNotifier(this._source);

  @override
  QuizSessionState build() {
    return QuizSessionState(quizzes: [], source: _source);
  }

  void startSession(List<QuizQuestion> quizzes) {
    state = QuizSessionState(quizzes: quizzes, source: _source);
  }

  void reset() {
    state = QuizSessionState(quizzes: [], source: _source);
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
    ref
        .read(analyticsServiceProvider)
        .logQuizSubmitted(
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
      // 정상 완료한 순간 — 스토어 리뷰 prompt 후보. throttle 조건
      // 충족 시에만 OS에 요청. finishEarly에서는 부르지 않음 (만족도
      // 보장 안 됨).
      ref.read(reviewPromptServiceProvider).maybePromptAfterQuiz();
    }
  }

  /// 사용자가 "여기까지 풀기"로 세션을 도중 종료. 남은 문제는
  /// attempt 기록하지 않고 결과 화면으로. attemptedCount만 결과
  /// 산정에 쓰이도록 finishedEarly=true.
  void finishEarly() {
    state = state.copyWith(isComplete: true, finishedEarly: true);
  }
}
