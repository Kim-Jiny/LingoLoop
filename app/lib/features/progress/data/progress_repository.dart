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

  Future<AchievementSummary> getAchievements() async {
    final response = await _dio.get('/api/progress/achievements');
    return AchievementSummary.fromJson(response.data);
  }

  Future<WeeklyReport> getWeeklyReport() async {
    final response = await _dio.get('/api/progress/weekly-report');
    return WeeklyReport.fromJson(response.data);
  }

  Future<HeatmapData> getHeatmap() async {
    final response = await _dio.get('/api/progress/heatmap');
    return HeatmapData.fromJson(response.data);
  }

  Future<SentenceProgressPage> getSentenceProgress({
    int page = 1,
    int limit = 20,
  }) async {
    final response = await _dio.get(
      '/api/progress/sentences',
      queryParameters: {'page': page, 'limit': limit},
    );
    return SentenceProgressPage.fromJson(response.data);
  }
}
