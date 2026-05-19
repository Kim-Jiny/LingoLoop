import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/vocabulary_repository.dart';
import 'vocabulary_model.dart';

final vocabularyListProvider = FutureProvider<VocabularyList>((ref) async {
  final repo = ref.read(vocabularyRepositoryProvider);
  return repo.list();
});
