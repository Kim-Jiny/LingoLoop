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

  Future<QuizResult> submitAnswer(int quizId, Map<String, dynamic> answer) async {
    final response = await _dio.post(
      '${ApiConstants.quizSubmit}/$quizId/submit',
      data: {'answer': answer},
    );
    return QuizResult.fromJson(response.data);
  }
}
