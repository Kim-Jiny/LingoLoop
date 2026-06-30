import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/version/version_gate.dart';
import '../../auth/domain/auth_provider.dart';
import '../data/purchase_service.dart';
import '../data/subscription_repository.dart';
import '../domain/subscription_provider.dart';
import 'subscription_history_sheet.dart';

class SubscriptionScreen extends ConsumerStatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  ConsumerState<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends ConsumerState<SubscriptionScreen>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // 화면 진입 시 1회 강제 refresh — admin이 backstage에서 grant/revoke
    // 한 변경 사항을 매 진입마다 캐치.
    Future.microtask(() {
      if (!mounted) return;
      ref.invalidate(subscriptionStatusProvider);
      // 메인/복습/퀴즈 화면이 보는 authStateProvider.user.isPremium도
      // 함께 새로고침 — 안 그러면 다른 탭에선 옛 tier 그대로.
      ref.read(authStateProvider.notifier).refreshCurrentUser();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // 백그라운드 → 포어그라운드 복귀 시도 refresh. silent push가 어떤
    // 이유로든 안 도달했어도 사용자가 앱을 다시 켤 때마다 catchup.
    if (state == AppLifecycleState.resumed && mounted) {
      ref.invalidate(subscriptionStatusProvider);
      ref.read(authStateProvider.notifier).refreshCurrentUser();
    }
  }

  Future<void> _pullRefresh() async {
    ref.invalidate(subscriptionStatusProvider);
    ref.invalidate(purchaseCatalogProvider);
    // authStateProvider도 같이 새로고침해 다른 탭의 user.isPremium 동기화.
    await Future.wait([
      ref.read(subscriptionStatusProvider.future),
      ref.read(authStateProvider.notifier).refreshCurrentUser(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final statusAsync = ref.watch(subscriptionStatusProvider);
    final catalogAsync = ref.watch(purchaseCatalogProvider);

    // Errors from inside the purchase stream listener fire here.
    // Without this, throwing PurchaseFailure inside the listener
    // escapes unhandled and the user sees nothing — even on a
    // permanent failure like "this subscription is tied to another
    // account".
    ref.listen<AsyncValue<PurchaseFailure>>(purchaseErrorsProvider, (
      prev,
      next,
    ) {
      final failure = next.value;
      if (failure == null) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(failure.message)));
    });

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('프리미엄')),
      body: statusAsync.when(
        // skipLoadingOnRefresh로 invalidate 후 refetch 중에도 이전 데이터를
        // 유지 — pull-to-refresh의 progress가 사라지지 않고, initState의
        // 자동 invalidate에서도 화면 깜빡임 없음. 진짜 첫 로딩(이전 값
        // 없음)에서만 spinner.
        skipLoadingOnRefresh: true,
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('구독 정보를 불러오지 못했어요.\n$e', textAlign: TextAlign.center),
          ),
        ),
        data: (status) => RefreshIndicator(
          color: AppColors.primary,
          onRefresh: _pullRefresh,
          child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
          children: [
            _PlanBanner(status: status),
            const SizedBox(height: 20),
            Text('프리미엄 혜택', style: Theme.of(context).textTheme.titleLarge),
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
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(color: Colors.white),
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
      final left = _daysLeftUntil(s.expiresAt);
      final leftStr = (left != null && left >= 0) ? '체험 $left일 남음 · ' : '';
      return '무료 체험 중 · $leftStr$dateStr 부터 자동 결제';
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
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
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
    // subscriptionStatusProvider 변경이 감지되면 AppShell의 listener가
    // reviewQueueProvider도 자동 invalidate해줌 (양방향 대칭). 여기선
    // 트리거만 발생시키면 됨.
    ref.invalidate(subscriptionStatusProvider);
    await ref.read(authStateProvider.notifier).refreshCurrentUser();
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('처리 중 문제가 발생했어요: $e')));
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
      final priceLabel = '${widget.status.displayPriceKrw}원';
      return Column(
        children: [
          const _LockedPreviewNote(),
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: () => SubscriptionHistorySheet.show(context),
            icon: const Icon(Icons.receipt_long_rounded),
            label: const Text('내 플랜 확인하기 (구매 기록)'),
          ),
          _SubscriptionDisclosure(priceLabel: priceLabel),
          const _LegalLinks(),
        ],
      );
    }

    if (widget.status.isPremium) {
      return _PremiumManageSection(
        status: widget.status,
        busy: _busy,
        onRestore: () => _run(
          () => ref
              .read(purchaseServiceProvider)
              .restorePurchases(onSynced: _refresh),
        ),
      );
    }

    if (!widget.catalog.isAvailable) {
      return _UnavailableNote(priceKrw: widget.status.displayPriceKrw);
    }

    final product = widget.catalog.premiumProduct;
    final priceLabel = product?.price ?? '${widget.status.displayPriceKrw}원';
    // 스토어 offer가 실제 체험을 부여하고, 이 플래그는 문구만 바꾼다.
    // 이미 체험을 소진한(=ineligible) 사용자에겐 스토어가 체험 없이
    // 바로 결제하지만, 그 판별은 스토어만 알 수 있어 문구는 동일.
    final showTrial = widget.catalog.trialEnabled;
    final trialDays = widget.catalog.trialDays;
    final buttonLabel = showTrial
        ? '$trialDays일 무료체험 시작 · 이후 $priceLabel/월'
        : '프리미엄 시작하기 · $priceLabel / 월';

    return Column(
      children: [
        _SubscriptionDisclosure(
          priceLabel: priceLabel,
          trialDays: showTrial ? trialDays : null,
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _busy || product == null
                ? null
                : () => _run(
                    () => ref
                        .read(purchaseServiceProvider)
                        .buyPremium(product: product, onSynced: _refresh),
                  ),
            icon: _busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.workspace_premium_rounded),
            label: Text(buttonLabel),
          ),
        ),
        TextButton.icon(
          onPressed: _busy
              ? null
              : () => _run(
                  () => ref
                      .read(purchaseServiceProvider)
                      .restorePurchases(onSynced: _refresh),
                ),
          icon: const Icon(Icons.restore_rounded),
          label: const Text('이전 구매 복원'),
        ),
        TextButton.icon(
          onPressed: () => SubscriptionHistorySheet.show(context),
          icon: const Icon(Icons.receipt_long_rounded),
          label: const Text('내 플랜 확인하기 (구매 기록)'),
        ),
        TextButton.icon(
          onPressed: () => context.push('/subscription/help'),
          icon: const Icon(Icons.info_outline_rounded),
          label: const Text('구독 안내'),
        ),
        const _LegalLinks(),
      ],
    );
  }
}

/// 체험/구독 만료까지 남은 일수. 오늘 끝나면 0, 이미 지났으면 음수,
/// 파싱 불가면 null. 자정 경계로 세지 않고 24h 단위 올림 — "1일 남음"이
/// 실제론 12시간 남았어도 사용자 기대(대략적 카운트다운)에 맞춘다.
int? _daysLeftUntil(String? iso) {
  if (iso == null) return null;
  final dt = DateTime.tryParse(iso)?.toLocal();
  if (dt == null) return null;
  final diff = dt.difference(DateTime.now());
  if (diff.isNegative) return diff.inDays; // 음수
  return diff.inHours ~/ 24 + (diff.inHours % 24 == 0 ? 0 : 1);
}

Future<void> _launchExternalUrl(BuildContext context, String url) async {
  final uri = Uri.parse(url);
  final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text('링크를 열 수 없어요: $url')));
  }
}

class _SubscriptionDisclosure extends StatelessWidget {
  final String priceLabel;

  /// null이면 체험 미노출 — 기존 문구 그대로. 값이 있으면 "N일 무료체험
  /// 후 결제" 문구를 추가로 보여준다.
  final int? trialDays;

  const _SubscriptionDisclosure({required this.priceLabel, this.trialDays});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final days = trialDays;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('월간 프리미엄', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            if (days != null && days > 0) ...[
              Text(
                '$days일 무료체험 후 자동 갱신 · $priceLabel / 월',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '체험 기간 종료 전까지 언제든 해지하면 결제되지 않아요.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ] else
              Text(
                '1개월 단위 자동 갱신 구독 · $priceLabel / 월',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            const SizedBox(height: 6),
            Text(
              '구독은 App Store 계정으로 결제되며, 현재 기간 종료 최소 24시간 전까지 취소하지 않으면 자동 갱신돼요. 구독 관리 및 자동 갱신 해지는 구매 후 App Store 계정 설정에서 할 수 있어요.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LegalLinks extends StatelessWidget {
  const _LegalLinks();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 4,
        runSpacing: 0,
        children: [
          TextButton(
            onPressed: () =>
                _launchExternalUrl(context, AppConstants.termsOfUseUrl),
            child: const Text('이용약관(EULA)'),
          ),
          Text(
            '·',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: AppColors.textHint),
          ),
          TextButton(
            onPressed: () =>
                _launchExternalUrl(context, AppConstants.privacyPolicyUrl),
            child: const Text('개인정보처리방침'),
          ),
        ],
      ),
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
            Icon(
              Icons.lock_outline_rounded,
              color: AppColors.primary,
              size: 36,
            ),
            const SizedBox(height: 12),
            Text('곧 출시 예정', style: Theme.of(context).textTheme.titleLarge),
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

/// Premium-only management surface. Stacks three things:
///   1) A "구독 정보" card showing the next billing or end date in plain
///      Korean so the user doesn't have to leave the app to find out
///      when they'll be charged next.
///   2) "구독 취소 (자동갱신 해지)" as the primary CTA — most users who
///      say "cancel" actually want to stop the renewal, not get a
///      refund. Wording explicitly reassures that the current period
///      stays usable.
///   3) Refund as a small secondary link — the rarer / more drastic
///      path, so it doesn't compete with the cancellation flow.
///
/// Cancellation itself happens on the store (Apple/Google policy);
/// we can only deep-link to the right page.
class _PremiumManageSection extends StatelessWidget {
  final SubscriptionStatus status;
  final bool busy;
  final VoidCallback onRestore;

  const _PremiumManageSection({
    required this.status,
    required this.busy,
    required this.onRestore,
  });

  String get _subscriptionsUrl {
    if (Platform.isIOS) {
      return 'https://apps.apple.com/account/subscriptions';
    }
    final productId = status.productId ?? 'lingoloop_premium_monthly';
    return 'https://play.google.com/store/account/subscriptions'
        '?sku=$productId&package=${AppConstants.packageName}';
  }

  String get _refundUrl {
    if (Platform.isIOS) {
      return 'https://reportaproblem.apple.com';
    }
    return 'https://support.google.com/googleplay/answer/2479637';
  }

  /// Format the server's ISO timestamp as "2026년 6월 22일" in device
  /// local time. Returns null when the input can't be parsed (we don't
  /// surface "-" because that's already handled by the caller).
  String? _formatKoreanDate(String? iso) {
    if (iso == null) return null;
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return null;
    return '${dt.year}년 ${dt.month}월 ${dt.day}일';
  }

  /// productId(store SKU)를 사용자가 읽을 수 있는 라벨로. raw id
  /// (lingoloop_premium_monthly)가 결제일 카드에 그대로 노출되던 걸
  /// 한글 상품명으로. 새 SKU 추가 시 여기에만 매핑 추가.
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

  Future<void> _launch(BuildContext context, String url) async {
    await _launchExternalUrl(context, url);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final storeLabel = Platform.isIOS ? 'App Store' : 'Play 스토어';
    final dateLabel = _formatKoreanDate(status.expiresAt);
    final priceLabel = '월 ${status.displayPriceKrw.toString()}원';

    // The headline / sub-line in the info card adapts to the user's
    // actual subscription state — autoRenew off means we shouldn't
    // mislead them with "다음 결제일", and trial users have a different
    // "first charge" framing.
    String headline;
    String subline;
    final planLabel = _planLabel(status.productId);
    if (!status.autoRenew && dateLabel != null) {
      headline = '구독 만료 예정';
      subline = '$dateLabel부터 무료 플랜으로 전환돼요.';
    } else if (status.inTrial && dateLabel != null) {
      final left = _daysLeftUntil(status.expiresAt);
      headline = (left != null && left >= 0)
          ? '무료 체험 중 · $left일 남음'
          : '무료 체험 중';
      subline = '$dateLabel부터 자동 결제가 시작돼요 · $priceLabel';
    } else if (dateLabel != null) {
      headline = '다음 결제일 · $dateLabel';
      subline = '$planLabel · $priceLabel';
    } else {
      headline = '프리미엄 이용 중';
      subline = '$planLabel · $priceLabel';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Info card — date is the primary thing users want to know.
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      status.autoRenew
                          ? Icons.autorenew_rounded
                          : Icons.event_busy_rounded,
                      color: status.autoRenew
                          ? AppColors.primary
                          : AppColors.warning,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(headline, style: theme.textTheme.titleMedium),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  subline,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        // Primary CTA: cancel auto-renewal. Hidden when already cancelled.
        if (status.autoRenew)
          ElevatedButton.icon(
            onPressed: busy ? null : () => _launch(context, _subscriptionsUrl),
            icon: const Icon(Icons.open_in_new_rounded),
            label: const Text('구독 취소 (자동갱신 해지)'),
          )
        else
          OutlinedButton.icon(
            onPressed: busy ? null : () => _launch(context, _subscriptionsUrl),
            icon: const Icon(Icons.open_in_new_rounded),
            label: Text('$storeLabel에서 결제 수단 변경'),
          ),
        const SizedBox(height: 8),
        Text(
          status.autoRenew
              ? '취소해도 결제한 기간이 끝나는 날까지는 그대로 이용할 수 있어요. 환불은 별도예요.'
              : '이미 자동갱신이 해지된 상태예요. 만료일까지 그대로 이용할 수 있어요.',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodySmall?.copyWith(
            color: AppColors.textSecondary,
          ),
        ),

        const SizedBox(height: 20),
        const Divider(),
        const SizedBox(height: 8),

        // 내 플랜 상세 + 구매 이력 (sheet)
        TextButton.icon(
          onPressed: () => SubscriptionHistorySheet.show(context),
          icon: const Icon(Icons.receipt_long_rounded),
          label: const Text('내 플랜 확인하기 (구매 기록)'),
        ),

        // Secondary actions: restore + refund. Smaller weight.
        TextButton.icon(
          onPressed: busy ? null : onRestore,
          icon: const Icon(Icons.restore_rounded),
          label: const Text('구매 복원'),
        ),
        TextButton.icon(
          onPressed: busy ? null : () => _launch(context, _refundUrl),
          icon: const Icon(Icons.help_outline_rounded),
          label: const Text('환불을 원하시면'),
        ),
        TextButton.icon(
          onPressed: () => context.push('/subscription/help'),
          icon: const Icon(Icons.info_outline_rounded),
          label: const Text('구독 안내 (한 ID = 한 계정 정책 등)'),
        ),
        const _LegalLinks(),
      ],
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
            Icon(Icons.info_outline_rounded, color: AppColors.info, size: 32),
            const SizedBox(height: 12),
            Text(
              '현재 환경에서는 결제가 비활성화되어 있어요.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 4),
            Text(
              '월간 프리미엄 · 1개월 단위 자동 갱신 구독',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 4),
            Text(
              '정식 출시 후 월 $priceKrw원에 이용할 수 있어요.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const _LegalLinks(),
          ],
        ),
      ),
    );
  }
}
