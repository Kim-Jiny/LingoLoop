import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../domain/progress_model.dart';

final progressRepositoryProvider = Provider<ProgressRepository>((ref) {
  return ProgressRepository(ref.read(dioProvider));
});

class ProgressRepository {
  final Dio _dio;

  ProgressRepository(this._dio);

  Future<LearningStats> getStats() async {
    final response = await _dio.get(ApiConstants.progressStats);
    return LearningStats.fromJson(response.data);
  }

  Future<void> recordExposure(int sentenceId) async {
    await _dio.post('${ApiConstants.progressExposure}/$sentenceId');
  }

  Future<AchievementSummary> getAchievements() async {
    final response = await _dio.get(ApiConstants.progressAchievements);
    return AchievementSummary.fromJson(response.data);
  }

  Future<WeeklyReport> getWeeklyReport() async {
    final response = await _dio.get(ApiConstants.progressWeeklyReport);
    return WeeklyReport.fromJson(response.data);
  }

  Future<HeatmapData> getHeatmap() async {
    final response = await _dio.get(ApiConstants.progressHeatmap);
    return HeatmapData.fromJson(response.data);
  }

  Future<SentenceProgressPage> getSentenceProgress({
    int page = 1,
    int limit = 20,
  }) async {
    final response = await _dio.get(
      ApiConstants.progressSentences,
      queryParameters: {'page': page, 'limit': limit},
    );
    return SentenceProgressPage.fromJson(response.data);
  }
}
