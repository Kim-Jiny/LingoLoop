import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/progress_repository.dart';
import 'progress_model.dart';

final learningStatsProvider = FutureProvider<LearningStats>((ref) async {
  final repo = ref.read(progressRepositoryProvider);
  return repo.getStats();
});

final sentenceProgressProvider = FutureProvider<SentenceProgressPage>((
  ref,
) async {
  final repo = ref.read(progressRepositoryProvider);
  return repo.getSentenceProgress();
});

final achievementsProvider = FutureProvider<AchievementSummary>((ref) async {
  final repo = ref.read(progressRepositoryProvider);
  return repo.getAchievements();
});

final weeklyReportProvider = FutureProvider<WeeklyReport>((ref) async {
  final repo = ref.read(progressRepositoryProvider);
  return repo.getWeeklyReport();
});

final heatmapProvider = FutureProvider<HeatmapData>((ref) async {
  final repo = ref.read(progressRepositoryProvider);
  return repo.getHeatmap();
});
