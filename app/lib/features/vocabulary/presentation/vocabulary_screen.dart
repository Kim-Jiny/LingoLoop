import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widget/home_widget_service.dart';
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

    ref.listen(vocabularyListProvider, (_, next) {
      final list = next.asData?.value;
      if (list == null) return;
      HomeWidgetService.updateVocabulary([
        for (final v in list.items)
          (
            word: v.word,
            meaning: v.meaning ?? '',
            sentence: v.sentenceText ?? '',
            translation: v.sentenceTranslation ?? '',
          ),
      ]);
    });

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text('단어장'),
          bottom: const TabBar(
            tabs: [
              Tab(text: '학습중'),
              Tab(text: '학습완료'),
            ],
          ),
        ),
        body: listAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                '단어장을 불러오지 못했어요.\n$e',
                textAlign: TextAlign.center,
              ),
            ),
          ),
          data: (list) {
            if (list.items.isEmpty) return const _EmptyState();
            final learning =
                list.items.where((i) => !i.isLearned).toList();
            final learned =
                list.items.where((i) => i.isLearned).toList();
            return TabBarView(
              children: [
                _VocabList(
                  items: learning,
                  emptyText: '학습중인 단어가 없어요.\n오늘의 문장에서 단어를 북마크해보세요.',
                ),
                _VocabList(
                  items: learned,
                  emptyText: '학습완료한 단어가 아직 없어요.\n학습중 탭에서 "완료"로 옮겨보세요.',
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _VocabList extends ConsumerWidget {
  final List<VocabularyItem> items;
  final String emptyText;

  const _VocabList({required this.items, required this.emptyText});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Text(
            emptyText,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ),
      );
    }
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async => ref.invalidate(vocabularyListProvider),
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
        itemCount: items.length,
        separatorBuilder: (context, index) => const SizedBox(height: 12),
        itemBuilder: (context, index) => _VocabCard(item: items[index]),
      ),
    );
  }
}

class _VocabCard extends ConsumerWidget {
  final VocabularyItem item;

  const _VocabCard({required this.item});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.read(vocabularyRepositoryProvider);
    Future<void> setStatus(String status) async {
      await repo.updateStatus(item.id, status);
      ref.invalidate(vocabularyListProvider);
    }

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
                  onPressed: () async {
                    await repo.remove(item.id);
                    ref.invalidate(vocabularyListProvider);
                  },
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
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerLeft,
              child: item.isLearned
                  ? OutlinedButton.icon(
                      onPressed: () => setStatus('learning'),
                      icon: const Icon(Icons.refresh_rounded, size: 18),
                      label: const Text('다시 학습'),
                    )
                  : OutlinedButton.icon(
                      onPressed: () => setStatus('learned'),
                      icon: const Icon(Icons.check_rounded, size: 18),
                      label: const Text('학습완료로 이동'),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
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
