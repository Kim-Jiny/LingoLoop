import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/cartoon.dart';
import '../domain/sentence_model.dart';
import '../domain/sentence_provider.dart';
import '../../../core/network/error_message.dart';

class HistoryScreen extends ConsumerStatefulWidget {
  const HistoryScreen({super.key});

  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends ConsumerState<HistoryScreen> {
  /// 화면에 이어 붙인 페이지 수. 서버는 page/limit를 지원하지만 앱이 항상
  /// 1페이지(20개)만 불러와 오래된 기록을 볼 수 없었다.
  int _pages = 1;

  @override
  Widget build(BuildContext context) {
    final historyAsync = ref.watch(sentenceHistoryProvider(1));

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('문장 히스토리')),
      body: historyAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: MascotMessage(message: friendlyErrorMessage(error, fallback: '학습 기록을 불러오지 못했어요.')),
          ),
        ),
        data: (history) {
          if (history.items.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: CartoonCard(
                  padding: EdgeInsets.zero,
                  child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Mascot(mood: MascotMood.sleepy, size: 64),
                        const SizedBox(height: 16),
                        Text(
                          '아직 저장된 문장이 없어요',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '하루 한 줄이 쌓이기 시작하면 여기에 복습 기록이 모입니다.',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          }

          // 2페이지 이후를 순서대로 이어 붙인다. 로딩/오류는 목록 끝에 표시.
          final items = [...history.items];
          Widget? footer;
          for (var p = 2; p <= _pages; p++) {
            final next = ref.watch(sentenceHistoryProvider(p));
            if (next.hasValue) {
              items.addAll(next.requireValue.items);
            } else if (next.hasError) {
              footer = Center(
                child: TextButton(
                  onPressed: () => ref.invalidate(sentenceHistoryProvider(p)),
                  child: const Text('불러오지 못했어요. 다시 시도'),
                ),
              );
              break;
            } else {
              footer = const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator()),
              );
              break;
            }
          }
          if (footer == null && _pages < history.totalPages) {
            footer = Center(
              child: OutlinedButton(
                onPressed: () => setState(() => _pages++),
                child: const Text('더 보기'),
              ),
            );
          }

          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              CartoonCard(
                padding: EdgeInsets.zero,
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    children: [
                      _SummaryChip(label: '전체', value: '${history.total}개 문장'),
                      const SizedBox(width: 12),
                      // "최근 N개 중 M개 완료" — 이전엔 라벨이 "완료"였지만
                      // 1페이지(20개) 안에서만 카운트해 전체(서버 total)와
                      // 비교하면 misleading. 페이지 범위를 명시해 동일 분모로.
                      _SummaryChip(
                        label: '불러온 ${items.length}개 중',
                        value:
                            '${items.where((item) => item.isCompleted).length}개 완료',
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              ...items.map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _HistoryCard(item: item),
                ),
              ),
              ?footer,
            ],
          );
        },
      ),
    );
  }
}

class _SummaryChip extends StatelessWidget {
  final String label;
  final String value;

  const _SummaryChip({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 4),
            Text(value, style: Theme.of(context).textTheme.titleMedium),
          ],
        ),
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  final SentenceHistoryItem item;

  const _HistoryCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return CartoonCard(
      padding: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: item.isCompleted
                        ? AppColors.success.withValues(alpha: 0.12)
                        : AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    item.isCompleted ? '복습 완료' : '복습 대기',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: item.isCompleted
                          ? AppColors.success
                          : AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  item.assignedDate,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              item.sentence.text,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(height: 1.35),
            ),
            const SizedBox(height: 8),
            Text(
              item.sentence.translation,
              style: Theme.of(
                context,
              ).textTheme.bodyLarge?.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
