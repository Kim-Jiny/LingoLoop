import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/version/version_gate.dart';
import '../../auth/domain/auth_provider.dart';
import '../data/purchase_service.dart';
import '../data/subscription_repository.dart';
import '../domain/subscription_provider.dart';

class SubscriptionScreen extends ConsumerWidget {
  const SubscriptionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statusAsync = ref.watch(subscriptionStatusProvider);
    final catalogAsync = ref.watch(purchaseCatalogProvider);

    // Errors from inside the purchase stream listener fire here.
    // Without this, throwing PurchaseFailure inside the listener
    // escapes unhandled and the user sees nothing — even on a
    // permanent failure like "this subscription is tied to another
    // account".
    ref.listen<AsyncValue<PurchaseFailure>>(purchaseErrorsProvider,
        (prev, next) {
      final failure = next.value;
      if (failure == null) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(failure.message)),
      );
    });

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('프리미엄')),
      body: statusAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('구독 정보를 불러오지 못했어요.\n$e',
                textAlign: TextAlign.center),
          ),
        ),
        data: (status) => ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
          children: [
            _PlanBanner(status: status),
            const SizedBox(height: 20),
            Text('프리미엄 혜택',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            const _BenefitTile(
              icon: Icons.quiz_rounded,
              title: '문장 퀴즈 무제한',
              subtitle: '매일 복습 퀴즈로 기억을 한 번 더 굳혀요.',
            ),
            const _BenefitTile(
              icon: Icons.notifications_active_rounded,
              title: '퀴즈 푸시 루프',
              subtitle: '문장 알림에 퀴즈 푸시까지 섞어 반복합니다.',
            ),
            const _BenefitTile(
              icon: Icons.replay_rounded,
              title: '복습 큐 무제한',
              subtitle: '무료는 한 번에 3개, 프리미엄은 망각곡선 기반 전체 문장을 한 세션에서 복습할 수 있어요.',
            ),
            const SizedBox(height: 24),
            catalogAsync.when(
              loading: () => const Center(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: CircularProgressIndicator(),
                ),
              ),
              error: (error, _) =>
                  _UnavailableNote(priceKrw: status.displayPriceKrw),
              data: (catalog) =>
                  _PurchaseSection(status: status, catalog: catalog),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlanBanner extends StatelessWidget {
  final SubscriptionStatus status;

  const _PlanBanner({required this.status});

  @override
  Widget build(BuildContext context) {
    final isPremium = status.isPremium;
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isPremium
              ? const [Color(0xFFF26B3A), Color(0xFFFFA86E)]
              : const [Color(0xFF2E2319), Color(0xFF5A4333)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isPremium
                    ? Icons.workspace_premium_rounded
                    : Icons.lock_outline_rounded,
                color: Colors.white,
              ),
              const SizedBox(width: 8),
              Text(
                isPremium ? '프리미엄 이용 중' : '무료 플랜',
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(color: Colors.white),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            _statusLine(status, isPremium),
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.white.withValues(alpha: 0.85),
                ),
          ),
        ],
      ),
    );
  }

  /// Format the banner subtitle. Surfaces the trial state, auto-renew
  /// off ("expires on …" instead of "renews on …"), and the expiry date
  /// when present.
  String _statusLine(SubscriptionStatus s, bool isPremium) {
    if (!isPremium) {
      return '하루 한 문장 루프는 무료로 계속 이용할 수 있어요.';
    }
    final dateStr = s.expiresAt?.split('T').first;
    if (s.inTrial && dateStr != null) {
      return '무료 체험 중 · $dateStr 부터 자동 결제';
    }
    if (s.autoRenew && dateStr != null) {
      return '$dateStr 에 자동 갱신';
    }
    if (dateStr != null) {
      return '$dateStr 까지 이용 가능 (자동 갱신 꺼짐)';
    }
    return '구독이 활성화되어 있어요.';
  }
}

class _BenefitTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _BenefitTile({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.accent,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: AppColors.primary),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(subtitle,
                      style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PurchaseSection extends ConsumerStatefulWidget {
  final SubscriptionStatus status;
  final PurchaseCatalog catalog;

  const _PurchaseSection({required this.status, required this.catalog});

  @override
  ConsumerState<_PurchaseSection> createState() => _PurchaseSectionState();
}

class _PurchaseSectionState extends ConsumerState<_PurchaseSection> {
  bool _busy = false;

  Future<void> _refresh() async {
    ref.invalidate(subscriptionStatusProvider);
    await ref.read(authStateProvider.notifier).refreshCurrentUser();
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('처리 중 문제가 발생했어요: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final iapUnlocked = ref.watch(iapUnlockedProvider);

    // 1.0.0 ships with the premium UI fully visible but no real
    // IAP wiring yet (App Store / Play products are still being
    // configured). Show a "곧 출시 예정" card instead of the
    // purchase button, but keep the benefits list visible so users
    // know what's coming.
    if (!iapUnlocked) {
      return const _LockedPreviewNote();
    }

    if (widget.status.isPremium) {
      return TextButton.icon(
        onPressed: _busy
            ? null
            : () => _run(() => ref
                .read(purchaseServiceProvider)
                .restorePurchases(onSynced: _refresh)),
        icon: const Icon(Icons.restore_rounded),
        label: const Text('구매 복원'),
      );
    }

    if (!widget.catalog.isAvailable) {
      return _UnavailableNote(priceKrw: widget.status.displayPriceKrw);
    }

    final product = widget.catalog.premiumProduct;
    final priceLabel = product?.price ?? '${widget.status.displayPriceKrw}원';

    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _busy || product == null
                ? null
                : () => _run(() => ref
                    .read(purchaseServiceProvider)
                    .buyPremium(product: product, onSynced: _refresh)),
            icon: _busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.workspace_premium_rounded),
            label: Text('프리미엄 시작하기 · $priceLabel / 월'),
          ),
        ),
        TextButton.icon(
          onPressed: _busy
              ? null
              : () => _run(() => ref
                  .read(purchaseServiceProvider)
                  .restorePurchases(onSynced: _refresh)),
          icon: const Icon(Icons.restore_rounded),
          label: const Text('이전 구매 복원'),
        ),
      ],
    );
  }
}

/// Shown while the build is preview-locked (pre-1.1.0). Tells the
/// user the value prop is real and gives them a "기다리세요" hook
/// without ever attempting an in_app_purchase call — which would
/// fail anyway, since the store products aren't live yet.
class _LockedPreviewNote extends StatelessWidget {
  const _LockedPreviewNote();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Icon(Icons.lock_outline_rounded,
                color: AppColors.primary, size: 36),
            const SizedBox(height: 12),
            Text(
              '곧 출시 예정',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 6),
            Text(
              '다음 업데이트에서 프리미엄 구독을 만나실 수 있어요. 지금은 미리보기 화면이에요.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

class _UnavailableNote extends StatelessWidget {
  final int priceKrw;

  const _UnavailableNote({required this.priceKrw});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Icon(Icons.info_outline_rounded,
                color: AppColors.info, size: 32),
            const SizedBox(height: 12),
            Text(
              '현재 환경에서는 결제가 비활성화되어 있어요.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 4),
            Text(
              '정식 출시 후 월 $priceKrw원에 이용할 수 있어요.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}
