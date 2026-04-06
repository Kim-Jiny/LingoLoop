import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/sentence_repository.dart';
import '../../progress/data/progress_repository.dart';
import 'sentence_model.dart';

final todaySentenceProvider = FutureProvider<TodaySentence>((ref) async {
  final repo = ref.read(sentenceRepositoryProvider);
  final progressRepo = ref.read(progressRepositoryProvider);
  final today = await repo.getToday();
  // Record that user viewed this sentence
  progressRepo.recordExposure(today.sentence.id);
  return today;
});

final sentenceHistoryProvider = FutureProvider.family<SentenceHistory, int>((
  ref,
  page,
) async {
  final repo = ref.read(sentenceRepositoryProvider);
  return repo.getHistory(page: page);
});
