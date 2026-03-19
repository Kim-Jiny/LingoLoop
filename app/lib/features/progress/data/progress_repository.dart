import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../domain/progress_model.dart';

final progressRepositoryProvider = Provider<ProgressRepository>((ref) {
  return ProgressRepository(ref.read(dioProvider));
});

class ProgressRepository {
  final Dio _dio;

  ProgressRepository(this._dio);

  Future<LearningStats> getStats() async {
    final response = await _dio.get('/api/progress/stats');
    return LearningStats.fromJson(response.data);
  }

  Future<void> recordExposure(int sentenceId) async {
    await _dio.post('/api/progress/exposure/$sentenceId');
  }
}
