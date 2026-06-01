import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../domain/quiz_model.dart';

final quizRepositoryProvider = Provider<QuizRepository>((ref) {
  return QuizRepository(ref.read(dioProvider));
});

class QuizRepository {
  final Dio _dio;

  QuizRepository(this._dio);

  Future<DailyQuiz> getDailyQuiz() async {
    final response = await _dio.get(ApiConstants.quizDaily);
    return DailyQuiz.fromJson(response.data);
  }

  Future<QuizResult> submitAnswer(
    int quizId,
    Map<String, dynamic> answer,
  ) async {
    final response = await _dio.post(
      '${ApiConstants.quizSubmit}/$quizId/submit',
      data: {'answer': answer},
    );
    return QuizResult.fromJson(response.data);
  }

  /// `category`로 quiz tab에 맞는 history만 조회 가능. null이면 전체.
  /// today / wordTyping / sentenceTyping / sentenceArrange.
  Future<QuizHistory> getHistory({
    int page = 1,
    int limit = 20,
    String? category,
  }) async {
    final response = await _dio.get(
      ApiConstants.quizHistory,
      queryParameters: {
        'page': page,
        'limit': limit,
        'category': ?category,
      },
    );
    return QuizHistory.fromJson(response.data);
  }

  Future<QuizProgress> getProgress() async {
    final response = await _dio.get(ApiConstants.quizProgress);
    return QuizProgress.fromJson(response.data);
  }

  Future<DailyQuiz> getReviewQueue() async {
    final response = await _dio.get(ApiConstants.quizReview);
    return DailyQuiz.fromJson(response.data);
  }

  Future<DailyQuiz> getDailyWordQuiz() async {
    final response = await _dio.get(ApiConstants.quizWordsDaily);
    return DailyQuiz.fromJson(response.data);
  }

  Future<DailyQuiz> getDailyWordListeningQuiz() async {
    final response = await _dio.get(ApiConstants.quizWordsListeningDaily);
    return DailyQuiz.fromJson(response.data);
  }

  Future<DailyQuiz> getDailySentenceListeningQuiz() async {
    final response = await _dio.get(ApiConstants.quizSentenceListeningDaily);
    return DailyQuiz.fromJson(response.data);
  }

  // 2026-05 redesign — narrower today, typed word/sentence quizzes.
  Future<DailyQuiz> getTodayQuiz() async {
    final response = await _dio.get(ApiConstants.quizToday);
    return DailyQuiz.fromJson(response.data);
  }

  Future<DailyQuiz> getWordLearningQuiz() async {
    final response = await _dio.get(ApiConstants.quizWordsLearning);
    return DailyQuiz.fromJson(response.data);
  }

  Future<DailyQuiz> getWordReviewQuiz() async {
    final response = await _dio.get(ApiConstants.quizWordsReview);
    return DailyQuiz.fromJson(response.data);
  }

  Future<DailyQuiz> getSentenceTypingQuiz() async {
    final response = await _dio.get(ApiConstants.quizSentenceDaily);
    return DailyQuiz.fromJson(response.data);
  }

  /// 단어 배열 전용 — 사용자가 lifetime 동안 완료한 모든 문장 중
  /// 랜덤 10개. 매 호출 다른 set.
  Future<DailyQuiz> getSentenceArrangeQuiz() async {
    final response = await _dio.get(ApiConstants.quizSentenceArrangeDaily);
    return DailyQuiz.fromJson(response.data);
  }

  /// 오늘 문장 카드의 '복습' 버튼 — 해당 문장 4문제. 프리미엄 게이트 없음.
  Future<DailyQuiz> getSentenceReviewQuiz(int sentenceId) async {
    final response = await _dio.get(
      '${ApiConstants.quizSentenceReviewBase}/$sentenceId/review',
    );
    return DailyQuiz.fromJson(response.data);
  }

  /// 위 '복습' 흐름 전용 submit. attempt가 source='sentence_review'로
  /// 분리 기록 — 일일 퀴즈 통계 미반영.
  Future<QuizResult> submitSentenceReviewAnswer(
    int quizId,
    Map<String, dynamic> answer,
  ) async {
    final response = await _dio.post(
      '${ApiConstants.quizSentenceReviewSubmit}/$quizId/submit',
      data: {'answer': answer},
    );
    return QuizResult.fromJson(response.data);
  }
}
