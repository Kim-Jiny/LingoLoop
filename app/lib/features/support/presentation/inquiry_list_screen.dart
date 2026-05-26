import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../data/inquiry_repository.dart';

/// 사용자의 본인 문의 + 관리자 답변 목록. 답변이 있으면 카드에
/// 같이 표시되고, 미확인 답변(isUnreadReply)은 상단 dot으로 강조.
/// 카드 열 때마다 서버에 markRead 호출해 dot을 끔.
final myInquiriesProvider = FutureProvider<InquiryListResponse>((ref) async {
  return ref.read(inquiryRepositoryProvider).listMine();
});

class InquiryListScreen extends ConsumerWidget {
  const InquiryListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myInquiriesProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('내 문의')),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async => ref.invalidate(myInquiriesProvider),
        child: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            children: [
              Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  '문의 내역을 불러오지 못했어요.\n$e',
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
          data: (response) {
            if (response.items.isEmpty) {
              return ListView(
                children: const [
                  Padding(
                    padding: EdgeInsets.all(48),
                    child: Column(
                      children: [
                        Icon(Icons.mail_outline_rounded,
                            size: 56, color: Colors.grey),
                        SizedBox(height: 12),
                        Text(
                          '아직 보낸 문의가 없어요',
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ],
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
              itemCount: response.items.length,
              itemBuilder: (context, i) {
                return _InquiryCard(inquiry: response.items[i]);
              },
            );
          },
        ),
      ),
    );
  }
}

class _InquiryCard extends ConsumerStatefulWidget {
  final Inquiry inquiry;
  const _InquiryCard({required this.inquiry});

  @override
  ConsumerState<_InquiryCard> createState() => _InquiryCardState();
}

class _InquiryCardState extends ConsumerState<_InquiryCard> {
  bool _expanded = false;
  bool _markedRead = false;

  Future<void> _toggle() async {
    setState(() => _expanded = !_expanded);
    // 첫 펼침에서 미확인 답변이면 서버에 read 보냄. 이후엔 안 보냄
    // (낭비). 다음 fetch에서 isUnreadReply=false로 내려옴.
    if (_expanded &&
        widget.inquiry.isUnreadReply &&
        !_markedRead) {
      _markedRead = true;
      try {
        await ref
            .read(inquiryRepositoryProvider)
            .markRead(widget.inquiry.id);
        ref.invalidate(myInquiriesProvider);
      } catch (_) {
        // markRead 실패는 침묵 — 다음 진입 시 다시 시도됨.
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final i = widget.inquiry;
    final theme = Theme.of(context);
    final hasReply = i.reply != null && i.reply!.isNotEmpty;
    final categoryLabel = i.category == 'subscription' ? '구독' : '일반';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: _toggle,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (i.isUnreadReply)
                    Container(
                      width: 8,
                      height: 8,
                      margin: const EdgeInsets.only(right: 8),
                      decoration: const BoxDecoration(
                        color: Colors.redAccent,
                        shape: BoxShape.circle,
                      ),
                    ),
                  Text(categoryLabel,
                      style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700)),
                  const Spacer(),
                  Text(
                    _formatDate(i.createdAt),
                    style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                i.message,
                style: theme.textTheme.bodyMedium,
                maxLines: _expanded ? null : 2,
                overflow:
                    _expanded ? TextOverflow.visible : TextOverflow.ellipsis,
              ),
              if (hasReply) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.reply_rounded,
                              size: 16, color: AppColors.primary),
                          const SizedBox(width: 4),
                          Text(
                            '답변',
                            style: theme.textTheme.bodySmall?.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w700),
                          ),
                          const Spacer(),
                          if (i.repliedAt != null)
                            Text(
                              _formatDate(i.repliedAt!),
                              style: theme.textTheme.bodySmall?.copyWith(
                                  color: AppColors.textSecondary),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        i.reply!,
                        style: theme.textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ] else ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.schedule_rounded,
                        size: 14, color: Colors.grey),
                    const SizedBox(width: 4),
                    Text(
                      '답변 대기 중',
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime dt) {
    final local = dt.toLocal();
    return '${local.year}.${local.month.toString().padLeft(2, '0')}.'
        '${local.day.toString().padLeft(2, '0')} '
        '${local.hour.toString().padLeft(2, '0')}:'
        '${local.minute.toString().padLeft(2, '0')}';
  }
}
