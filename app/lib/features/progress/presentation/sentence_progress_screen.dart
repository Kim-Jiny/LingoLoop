import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/cartoon.dart';
import '../domain/progress_provider.dart';
import '../../../core/network/error_message.dart';

class SentenceProgressScreen extends ConsumerStatefulWidget {
  const SentenceProgressScreen({super.key});

  @override
  ConsumerState<SentenceProgressScreen> createState() =>
      _SentenceProgressScreenState();
}

class _SentenceProgressScreenState
    extends ConsumerState<SentenceProgressScreen> {
  int _pages = 1;

  @override
  Widget build(BuildContext context) {
    final progressAsync = ref.watch(sentenceProgressProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('문장별 진행도')),
      body: progressAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text(friendlyErrorMessage(error, fallback: '문장별 진행도를 불러오지 못했어요.'))),
        data: (page) {
          if (page.items.isEmpty) {
            return const Center(child: Text('아직 기록된 문장이 없습니다.'));
          }

          final items = [...page.items];
          var loadingMore = false;
          Object? moreError;
          for (var pg = 2; pg <= _pages; pg++) {
            final more = ref.watch(sentenceProgressPageProvider(pg));
            if (more.hasValue) {
              items.addAll(more.requireValue.items);
            } else if (more.hasError) {
              moreError = more.error;
              break;
            } else {
              loadingMore = true;
              break;
            }
          }
          final canLoadMore =
              !loadingMore && moreError == null && _pages < page.totalPages;
          final hasFooter = canLoadMore || loadingMore || moreError != null;

          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            itemCount: items.length + (hasFooter ? 1 : 0),
            separatorBuilder: (_, index) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              if (index >= items.length) {
                if (loadingMore) {
                  return const Padding(
                    padding: EdgeInsets.all(16),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                if (moreError != null) {
                  return TextButton(
                    onPressed: () =>
                        ref.invalidate(sentenceProgressPageProvider(_pages)),
                    child: const Text('불러오지 못했어요. 다시 시도'),
                  );
                }
                return TextButton(
                  onPressed: () => setState(() => _pages += 1),
                  child: const Text('더 보기'),
                );
              }
              final item = items[index];
              return CartoonCard(
                padding: EdgeInsets.zero,
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.sentenceText ?? '문장 ${item.sentenceId}',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      if (item.sentenceTranslation != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          item.sentenceTranslation!,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                      const SizedBox(height: 14),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          value: item.masteryScore / 100,
                          minHeight: 10,
                          backgroundColor: AppColors.surfaceLight,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            item.masteryScore >= 80
                                ? AppColors.success
                                : item.masteryScore >= 50
                                ? AppColors.warning
                                : AppColors.error,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(child: Text('노출 ${item.exposureCount}회')),
                          Expanded(child: Text('퀴즈 ${item.quizAttempts}회')),
                          Expanded(
                            child: Text(
                              '숙련도 ${item.masteryScore}%',
                              textAlign: TextAlign.right,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
