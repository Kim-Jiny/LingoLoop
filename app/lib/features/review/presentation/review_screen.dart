import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/domain/auth_provider.dart';
import '../../progress/data/progress_repository.dart';
import '../../progress/domain/progress_provider.dart';
import '../../tts/tts_service.dart';
import '../domain/review_model.dart';
import '../domain/review_provider.dart';

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

class ReviewScreen extends ConsumerWidget {
  const ReviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queueAsync = ref.watch(reviewQueueProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('복습 루프')),
      body: queueAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('복습 목록을 불러오지 못했어요.\n$e', textAlign: TextAlign.center),
          ),
        ),
        data: (queue) =>
            queue.items.isEmpty ? const _AllClear() : _ReviewFlow(queue: queue),
      ),
    );
  }
}

class _AllClear extends StatelessWidget {
  const _AllClear();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.task_alt_rounded,
              size: 56,
              color: AppColors.success,
            ),
            const SizedBox(height: 16),
            Text(
              '지금 복습할 문장이 없어요',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              '망각곡선에 맞춰 다시 떠올릴 때가 되면\n여기에 문장이 모입니다.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

class _ReviewFlow extends ConsumerStatefulWidget {
  final ReviewQueue queue;

  const _ReviewFlow({required this.queue});

  @override
  ConsumerState<_ReviewFlow> createState() => _ReviewFlowState();
}

class _ReviewFlowState extends ConsumerState<_ReviewFlow> {
  int _index = 0;
  bool _revealed = false;
  bool _busy = false;

  Future<void> _next(ReviewItem item) async {
    setState(() => _busy = true);
    await ref.read(progressRepositoryProvider).recordExposure(item.sentenceId);

    if (_index + 1 >= widget.queue.items.length) {
      ref.invalidate(learningStatsProvider);
      ref.invalidate(reviewQueueProvider);
      if (mounted) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('복습 완료'),
            content: Text('${widget.queue.items.length}개 문장을 다시 떠올렸어요.'),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.pop(context);
                },
                child: const Text('확인'),
              ),
            ],
          ),
        );
      }
      return;
    }

    setState(() {
      _index += 1;
      _revealed = false;
      _busy = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.queue.items[_index];
    final theme = Theme.of(context);
    final lang =
        ref.watch(authStateProvider).asData?.value?.targetLanguage ?? 'en';
    final progress = (_index + 1) / widget.queue.items.length;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
      children: [
        Row(
          children: [
            Text(
              '${_index + 1} / ${widget.queue.items.length}',
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 8,
                  backgroundColor: AppColors.surfaceLight,
                  valueColor: const AlwaysStoppedAnimation<Color>(
                    AppColors.primary,
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    item.overdueDays > 0
                        ? '${item.overdueDays}일 지난 복습 · 숙련도 ${item.masteryScore}%'
                        : '복습 시점 도래 · 숙련도 ${item.masteryScore}%',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.warning,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  item.sentence.text,
                  style: theme.textTheme.headlineMedium?.copyWith(height: 1.35),
                ),
                const SizedBox(height: 16),
                Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton.icon(
                    onPressed: () => ref
                        .read(ttsServiceProvider)
                        .speak(
                          item.sentence.text,
                          language: _ttsLanguage(lang),
                        ),
                    icon: const Icon(Icons.volume_up_rounded),
                    label: const Text('발음 듣기'),
                  ),
                ),
                if (_revealed) ...[
                  const Divider(height: 32),
                  Text(
                    item.sentence.translation,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  if (item.sentence.words.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    ...item.sentence.words.map(
                      (w) => Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Text(
                          '· ${w.word} — ${w.meaning}',
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        if (!_revealed)
          ElevatedButton.icon(
            onPressed: () => setState(() => _revealed = true),
            icon: const Icon(Icons.visibility_outlined),
            label: const Text('뜻 확인하기'),
          )
        else
          ElevatedButton.icon(
            onPressed: _busy ? null : () => _next(item),
            icon: const Icon(Icons.check_circle_outline_rounded),
            label: Text(
              _index + 1 >= widget.queue.items.length ? '복습 마무리' : '기억했어요',
            ),
          ),
      ],
    );
  }
}
