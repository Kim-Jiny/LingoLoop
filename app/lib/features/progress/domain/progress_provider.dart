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
