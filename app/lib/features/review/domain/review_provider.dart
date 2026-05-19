import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/review_repository.dart';
import 'review_model.dart';

final reviewQueueProvider = FutureProvider<ReviewQueue>((ref) async {
  final repo = ref.read(reviewRepositoryProvider);
  return repo.getQueue();
});
