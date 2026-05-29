import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../data/subscription_repository.dart';
import '../domain/subscription_status_provider.dart';

/// 사용자 본인의 구독 이력 시트.
///
/// '내 플랜 확인하기' 버튼에서 호출. 헤더에 현재 상태 요약, 아래에
/// 구매/갱신/해지/환불/만료 이력을 시간 역순으로 표시.
class SubscriptionHistorySheet extends ConsumerWidget {
  const SubscriptionHistorySheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: AppColors.background,
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => const SubscriptionHistorySheet(),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statusAsync = ref.watch(subscriptionStatusProvider);
    final historyAsync = ref.watch(_historyProvider);

    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text(
              '내 구독 상세',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            statusAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Text('상태를 불러오지 못했어요.\n$e'),
              data: (status) => _StatusCard(status: status),
            ),
            const SizedBox(height: 20),
            Text('이력', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            historyAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Text('이력을 불러오지 못했어요.\n$e'),
              ),
              data: (items) {
                if (items.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: Center(
                      child: Text(
                        '기록이 없습니다.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                  );
                }
                return Column(
                  children: [
                    for (final it in items) _HistoryRow(item: it),
                  ],
                );
              },
            ),
            const SizedBox(height: 12),
            Center(
              child: TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('닫기'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

final _historyProvider =
    FutureProvider<List<SubscriptionHistoryItem>>((ref) async {
  final repo = ref.read(subscriptionRepositoryProvider);
  return repo.getHistory();
});

class _StatusCard extends StatelessWidget {
  final SubscriptionStatus status;
  const _StatusCard({required this.status});

  String? _fmt(String? iso) {
    if (iso == null) return null;
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return null;
    return '${dt.year}년 ${dt.month}월 ${dt.day}일';
  }

  String _planLabel(String? productId) {
    switch (productId) {
      case 'lingoloop_premium_monthly':
        return '월간 프리미엄';
      case 'lingoloop_premium_yearly':
        return '연간 프리미엄';
      default:
        return '프리미엄';
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dateLabel = _fmt(status.expiresAt);
    final price = '월 ${status.displayPriceKrw}원';
    final isPremium = status.isPremium;

    String headline;
    String subline;
    IconData icon;
    Color iconColor;

    if (!isPremium) {
      headline = '무료 플랜';
      subline = '프리미엄 구독을 시작하면 모든 기능을 이용할 수 있어요.';
      icon = Icons.lock_open_rounded;
      iconColor = AppColors.textSecondary;
    } else if (!status.autoRenew && dateLabel != null) {
      headline = '구독 만료 예정';
      subline = '$dateLabel부터 무료 플랜으로 전환돼요.';
      icon = Icons.event_busy_rounded;
      iconColor = AppColors.warning;
    } else if (status.inTrial && dateLabel != null) {
      headline = '무료 체험 중';
      subline = '$dateLabel부터 자동 결제 · $price';
      icon = Icons.card_giftcard_rounded;
      iconColor = AppColors.primary;
    } else if (dateLabel != null) {
      headline = '다음 결제일 · $dateLabel';
      subline = '${_planLabel(status.productId)} · $price · 자동 갱신';
      icon = Icons.autorenew_rounded;
      iconColor = AppColors.primary;
    } else {
      headline = '프리미엄 이용 중';
      subline = _planLabel(status.productId);
      icon = Icons.workspace_premium_rounded;
      iconColor = AppColors.primary;
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(icon, color: iconColor, size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(headline, style: theme.textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(
                    subline,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  final SubscriptionHistoryItem item;
  const _HistoryRow({required this.item});

  IconData get _icon {
    switch (item.kind) {
      case 'purchase':
        return Icons.shopping_bag_rounded;
      case 'renew':
        return Icons.autorenew_rounded;
      case 'cancel':
        return Icons.cancel_outlined;
      case 'resume':
        return Icons.replay_rounded;
      case 'refund':
        return Icons.undo_rounded;
      case 'expire':
        return Icons.event_busy_rounded;
      case 'trial':
        return Icons.card_giftcard_rounded;
      case 'grant':
        return Icons.admin_panel_settings_rounded;
      case 'revoke':
        return Icons.no_accounts_rounded;
      default:
        return Icons.history_rounded;
    }
  }

  Color _colorOf(BuildContext context) {
    switch (item.kind) {
      case 'cancel':
      case 'expire':
      case 'revoke':
        return AppColors.warning;
      case 'refund':
        return AppColors.error;
      default:
        return AppColors.primary;
    }
  }

  String _fmtDate(DateTime dt) {
    final local = dt.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${local.year}.${two(local.month)}.${two(local.day)} '
        '${two(local.hour)}:${two(local.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = _colorOf(context);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(_icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.label, style: theme.textTheme.titleSmall),
                const SizedBox(height: 2),
                Text(
                  _fmtDate(item.occurredAt),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                if (item.note != null && item.note!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    item.note!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
