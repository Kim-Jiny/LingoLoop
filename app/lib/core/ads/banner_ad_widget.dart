import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import '../../features/auth/domain/auth_provider.dart';
import '../../features/subscription/domain/subscription_provider.dart';
import 'ad_ids.dart';

/// 4탭(오늘/복습/기록/설정) 하단에 들어가는 배너 광고.
///
/// 동작:
///   - 프리미엄 사용자 → SizedBox.shrink (아예 자리도 안 만듦).
///   - 무료 사용자 → adaptive banner. 로딩 중엔 빈 자리만 미리 잡아
///     (estimated height) scroll/layout 튐 방지.
///   - load 실패는 silent — 영구 빈 자리만.
///
/// `subscriptionStatusProvider`는 캐싱돼 있어 매 탭 전환마다 fetch
/// 하지 않음. premium 상태 변경(verify/webhook)이 일어나면 자동
/// invalidate되어 광고도 즉시 사라짐.
class BannerAdWidget extends ConsumerStatefulWidget {
  final AdTab tab;

  const BannerAdWidget({super.key, required this.tab});

  @override
  ConsumerState<BannerAdWidget> createState() => _BannerAdWidgetState();
}

class _BannerAdWidgetState extends ConsumerState<BannerAdWidget> {
  BannerAd? _ad;
  bool _loaded = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    // premium flip 감지 — 무료 → 프리미엄 전환 시 살아있던 BannerAd 즉시
    // dispose해서 메모리 누수 방지. ref.listenManual은 widget 생명주기
    // 동안 자동 cleanup.
    ref.listenManual(subscriptionStatusProvider, (prev, next) {
      final wasPremium = prev?.asData?.value.isPremium ?? false;
      final isPremium = next.asData?.value.isPremium ?? false;
      if (!wasPremium && isPremium && _ad != null) {
        _ad?.dispose();
        _ad = null;
        if (mounted) {
          setState(() {
            _loaded = false;
          });
        }
      }
    });
  }

  @override
  void dispose() {
    _ad?.dispose();
    super.dispose();
  }

  Future<void> _loadAd() async {
    if (!mounted || _ad != null || _failed) return;
    final width = MediaQuery.of(context).size.width.truncate();
    final size =
        await AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(width);
    if (!mounted) return;
    if (size == null) {
      // 크기 결정 실패 (e.g., desktop emulator) — 빈 자리로 두고 더 시도 안 함.
      setState(() => _failed = true);
      return;
    }
    final ad = BannerAd(
      adUnitId: AdIds.tabBanner(widget.tab),
      size: size,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (loadedAd) {
          if (!mounted) {
            // load 끝났지만 widget 사라짐 — 콜백 내에서 dispose.
            loadedAd.dispose();
            return;
          }
          setState(() => _loaded = true);
        },
        onAdFailedToLoad: (bannerAd, _) {
          bannerAd.dispose();
          if (!mounted) return;
          setState(() {
            _ad = null;
            _failed = true;
          });
        },
      ),
    );
    _ad = ad;
    try {
      await ad.load();
    } catch (_) {
      // SDK 초기화 실패 / 잘못된 ad unit ID — silent. listener의
      // onAdFailedToLoad가 정상 path. catch는 추가 안전망.
    }
    if (!mounted) {
      ad.dispose();
      _ad = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    // premium이면 광고 아예 안 그림 (자리도 X).
    final subscription = ref.watch(subscriptionStatusProvider).asData?.value;
    final user = ref.watch(authStateProvider).asData?.value;
    final isPremium =
        subscription?.isPremium ?? (user?.isPremium ?? false);
    if (isPremium) return const SizedBox.shrink();

    // 첫 빌드에서 adaptive size 계산 + 로드. PostFrame으로 MediaQuery
    // 사용 안전.
    if (_ad == null && !_failed) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadAd());
    }

    if (_failed) return const SizedBox.shrink();
    if (!_loaded || _ad == null) {
      // load 중 빈 자리 — 광고 banner 높이만큼 미리 잡아두면 layout 튐 X.
      // adaptive size는 화면 폭에 따라 50~100 사이라 50 fallback.
      return const SizedBox(height: 50);
    }
    return SafeArea(
      top: false,
      bottom: false,
      child: SizedBox(
        height: _ad!.size.height.toDouble(),
        width: _ad!.size.width.toDouble(),
        child: AdWidget(ad: _ad!),
      ),
    );
  }
}
