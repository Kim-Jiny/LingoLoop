import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../domain/sentence_provider.dart';
import '../domain/sentence_model.dart';

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(sentenceHistoryProvider(1));

    return Scaffold(
      appBar: AppBar(title: const Text('학습 기록')),
      body: historyAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('오류: $e')),
        data: (history) {
          if (history.items.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.history, size: 64, color: AppColors.textHint),
                  SizedBox(height: 16),
                  Text('아직 학습 기록이 없습니다'),
                ],
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: history.items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final item = history.items[index];
              return _HistoryCard(item: item);
            },
          );
        },
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  final SentenceHistoryItem item;
  const _HistoryCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  item.assignedDate,
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.textHint,
                  ),
                ),
                const Spacer(),
                Icon(
                  item.isCompleted
                      ? Icons.check_circle
                      : Icons.radio_button_unchecked,
                  size: 18,
                  color: item.isCompleted
                      ? AppColors.success
                      : AppColors.textHint,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              item.sentence.text,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              item.sentence.translation,
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
