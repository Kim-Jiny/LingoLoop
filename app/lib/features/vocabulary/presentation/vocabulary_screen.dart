import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/domain/auth_provider.dart';
import '../../tts/tts_service.dart';
import '../data/vocabulary_repository.dart';
import '../domain/vocabulary_model.dart';
import '../domain/vocabulary_provider.dart';

String _ttsLanguage(String code) {
  switch (code) {
    case 'ja':
      return 'ja-JP';
    case 'es':
      return 'es-ES';
    case 'ko':
      return 'ko-KR';
    default:
      return 'en-US';
  }
}

class VocabularyScreen extends ConsumerWidget {
  const VocabularyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final listAsync = ref.watch(vocabularyListProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('단어장')),
      body: listAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('단어장을 불러오지 못했어요.\n$e', textAlign: TextAlign.center),
          ),
        ),
        data: (list) => list.items.isEmpty
            ? _EmptyState()
            : RefreshIndicator(
                color: AppColors.primary,
                onRefresh: () async =>
                    ref.invalidate(vocabularyListProvider),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
                  itemCount: list.items.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 12),
                  itemBuilder: (context, index) => _VocabCard(
                    item: list.items[index],
                    onDelete: () async {
                      await ref
                          .read(vocabularyRepositoryProvider)
                          .remove(list.items[index].id);
                      ref.invalidate(vocabularyListProvider);
                    },
                  ),
                ),
              ),
      ),
    );
  }
}

class _VocabCard extends ConsumerWidget {
  final VocabularyItem item;
  final Future<void> Function() onDelete;

  const _VocabCard({required this.item, required this.onDelete});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    item.word,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                IconButton(
                  tooltip: '발음 듣기',
                  onPressed: () => ref.read(ttsServiceProvider).speak(
                        item.word,
                        language: _ttsLanguage(
                          ref
                                  .read(authStateProvider)
                                  .asData
                                  ?.value
                                  ?.targetLanguage ??
                              'en',
                        ),
                      ),
                  icon: const Icon(Icons.volume_up_outlined),
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.surfaceLight,
                    foregroundColor: AppColors.primary,
                  ),
                ),
                IconButton(
                  tooltip: '삭제',
                  onPressed: onDelete,
                  icon: const Icon(Icons.delete_outline_rounded),
                  color: AppColors.error,
                ),
              ],
            ),
            if (item.meaning != null && item.meaning!.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                item.meaning!,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
            ],
            if (item.context != null && item.context!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  item.context!,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontStyle: FontStyle.italic,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.bookmark_border_rounded,
              size: 56,
              color: AppColors.textHint,
            ),
            const SizedBox(height: 16),
            Text(
              '아직 저장한 단어가 없어요',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              '오늘의 문장에서 단어 옆 북마크 버튼을 누르면\n여기에 모여요.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}
