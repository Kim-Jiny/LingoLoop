import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../domain/sentence_model.dart';

final sentenceRepositoryProvider = Provider<SentenceRepository>((ref) {
  return SentenceRepository(ref.read(dioProvider));
});

class SentenceRepository {
  final Dio _dio;

  SentenceRepository(this._dio);

  Future<TodaySentence> getToday() async {
    final response = await _dio.get(ApiConstants.sentencesToday);
    return TodaySentence.fromJson(response.data);
  }

  Future<SentenceHistory> getHistory({int page = 1, int limit = 20}) async {
    final response = await _dio.get(
      ApiConstants.sentencesHistory,
      queryParameters: {'page': page, 'limit': limit},
    );
    return SentenceHistory.fromJson(response.data);
  }
}
