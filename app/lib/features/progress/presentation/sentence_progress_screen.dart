import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../domain/progress_provider.dart';

class SentenceProgressScreen extends ConsumerWidget {
  const SentenceProgressScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progressAsync = ref.watch(sentenceProgressProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('문장별 진행도')),
      body: progressAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('문장별 진행도를 불러오지 못했어요.\n$error')),
        data: (page) {
          if (page.items.isEmpty) {
            return const Center(child: Text('아직 기록된 문장이 없습니다.'));
          }

          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            itemCount: page.items.length,
            separatorBuilder: (_, index) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final item = page.items[index];
              return Card(
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
