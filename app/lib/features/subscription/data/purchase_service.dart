import 'dart:async';
import 'dart:developer' as developer;
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
// Android는 구독 offer(base plan / 무료체험 등)마다 별도의
// ProductDetails를 돌려주고, 어떤 offer로 결제할지는 그 인스턴스가
// 결정한다. 올바른 offer를 고르고 정가를 뽑으려면 플랫폼 타입이 필요.
import 'package:in_app_purchase_android/billing_client_wrappers.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';

import '../../../core/analytics/analytics_service.dart';
import '../../auth/domain/auth_provider.dart';
import '../../config/data/app_config_repository.dart';
import '../domain/subscription_status_provider.dart';
import 'subscription_repository.dart';

/// 스토어 SDK 진입점. `InAppPurchase.instance`를 직접 참조하지 않고
/// provider로 감싸는 이유는 테스트에서 갈아끼우기 위함 — 결제 검증
/// 실패 처리(어떤 상태 코드에서 트랜잭션을 큐에 남길지)는 실기기로는
/// 재현이 거의 불가능한데 회귀하면 사용자가 돈을 내고 권한을 못 받는다.
final inAppPurchaseProvider = Provider<InAppPurchase>((ref) {
  return InAppPurchase.instance;
});

final purchaseServiceProvider = Provider<PurchaseService>((ref) {
  final service = PurchaseService(
    ref,
    ref.read(subscriptionRepositoryProvider),
    ref.read(appConfigRepositoryProvider),
    ref.read(analyticsServiceProvider),
    ref.read(inAppPurchaseProvider),
  );
  ref.onDispose(service.dispose);
  return service;
});

/// Stream of user-visible purchase errors. The screen subscribes and
/// surfaces these as SnackBars. Without this, errors thrown inside
/// the StoreKit/BillingClient stream listener escape into Zone-level
/// uncaught handlers and the user sees nothing.
final purchaseErrorsProvider = StreamProvider<PurchaseFailure>((ref) {
  final service = ref.watch(purchaseServiceProvider);
  return service.errors;
});

/// Surfaced to the UI when a purchase fails mid-flow so we can show a
/// user-facing message instead of silently swallowing the error.
class PurchaseFailure implements Exception {
  final String message;
  PurchaseFailure(this.message);
  @override
  String toString() => message;
}

/// 4xx지만 "영수증이 잘못됐다"는 뜻이 아닌 상태 코드들. 이걸 영구 실패로
/// 처리하면 결제한 사용자의 트랜잭션을 스토어 큐에서 지워버려 재시도
/// 수단을 뺏는다.
///   401/403 — 이쪽 인증 상태 문제(토큰 갱신 중이었거나 세션이 끊김).
///             영수증과 무관하고, 다시 로그인하면 그대로 검증된다.
///   408/429 — 서버가 대놓고 "나중에 다시" 라고 답한 경우.
const Set<int> _retriableStatuses = {401, 403, 408, 429};

class PurchaseCatalog {
  final bool isAvailable;
  final String productId;
  final List<ProductDetails> products;
  final List<String> notFoundIds;

  /// 무료체험 노출 토글 + 일수. 서버 remote config에서 옴. 스토어
  /// offer가 실제 체험을 부여하고, 이 값은 paywall 문구 제어용.
  final bool trialEnabled;
  final int trialDays;

  const PurchaseCatalog({
    required this.isAvailable,
    required this.productId,
    required this.products,
    required this.notFoundIds,
    this.trialEnabled = false,
    this.trialDays = 7,
  });

  /// 결제에 사용할 상품. Android에서 `queryProductDetails`는 하나의
  /// 구독 productId에 대해 **offer 개수만큼** ProductDetails를 돌려준다
  /// (base plan 1개 + 무료체험 offer 1개 → 2개, id는 모두 동일).
  /// 그리고 어느 인스턴스를 PurchaseParam에 넘기느냐가 곧 어떤 offer로
  /// 결제되는지를 결정한다(내부적으로 offerToken).
  ///
  /// 예전엔 id만 맞는 첫 항목을 집었는데, Google이 offer 순서를 보장하지
  /// 않아 (a) 무료체험 버튼을 눌렀는데 base plan으로 즉시 결제되거나
  /// (b) 표시 가격이 체험 phase의 0원이 되는 문제가 있었다.
  ///
  /// Play는 **사용자가 자격을 갖춘 offer만** 내려주므로, 목록에 무료
  /// phase를 가진 offer가 있으면 그걸 고르는 게 언제나 사용자에게
  /// 유리하다(체험을 이미 소진했다면 애초에 목록에 없다).
  ProductDetails? get premiumProduct {
    final matching = products.where((p) => p.id == productId).toList();
    if (matching.isEmpty) return null;
    for (final product in matching) {
      if (_freeTrialPhase(product) != null) return product;
    }
    return matching.first;
  }

  /// 화면에 노출할 "월 정가". `ProductDetails.price`는 Android 무료체험
  /// offer에서 첫 pricing phase(=0원)를 가리키므로 그대로 쓰면 결제
  /// 금액을 잘못 고지하게 된다. 정기 결제 phase의 가격을 뽑아 쓴다.
  String? get premiumPriceLabel {
    final product = premiumProduct;
    if (product == null) return null;
    final offer = _offerOf(product);
    // iOS(StoreKit) 등 offer 개념이 없는 플랫폼은 price가 이미 정가.
    if (offer == null) return product.price;
    final phases = offer.pricingPhases;
    if (phases.isEmpty) return product.price;
    // 무한 반복 phase = 체험/할인이 끝난 뒤 계속 청구되는 실제 구독료.
    // 명시적으로 없으면 마지막 phase가 최종 청구 단계다.
    final recurring = phases.lastWhere(
      (phase) => phase.recurrenceMode == RecurrenceMode.infiniteRecurring,
      orElse: () => phases.last,
    );
    return recurring.formattedPrice;
  }

  /// 스토어가 실제로 무료체험 offer를 내려줬는지. Android는 자격 있는
  /// offer만 오기 때문에 이 값이 정확하다. iOS는 이 정보를 노출하지
  /// 않으므로 remote config의 [trialEnabled]를 그대로 따른다 —
  /// 즉 iOS 동작은 기존과 동일하다.
  bool get storeTrialAvailable {
    final product = premiumProduct;
    if (product == null || _offerOf(product) == null) return trialEnabled;
    return _freeTrialPhase(product) != null;
  }

  /// [product]가 가리키는 Android 구독 offer. 다른 플랫폼이면 null.
  static SubscriptionOfferDetailsWrapper? _offerOf(ProductDetails product) {
    if (product is! GooglePlayProductDetails) return null;
    final index = product.subscriptionIndex;
    final offers = product.productDetails.subscriptionOfferDetails;
    if (index == null || offers == null || index >= offers.length) return null;
    return offers[index];
  }

  /// offer 안의 0원 phase(=무료체험). 없으면 null.
  static PricingPhaseWrapper? _freeTrialPhase(ProductDetails product) {
    final offer = _offerOf(product);
    if (offer == null) return null;
    for (final phase in offer.pricingPhases) {
      if (phase.priceAmountMicros == 0) return phase;
    }
    return null;
  }
}

class PurchaseService {
  /// Provider-scoped Ref — 위젯 lifecycle과 독립. 구독 화면을 뒤로가도
  /// purchase stream listener는 살아있고, verify 성공 시 직접
  /// subscriptionStatusProvider를 invalidate해서 UI가 동기화되게.
  final Ref _ref;
  final InAppPurchase _inAppPurchase;
  final SubscriptionRepository _subscriptionRepository;
  final AppConfigRepository _appConfigRepository;
  final AnalyticsService _analytics;
  StreamSubscription<List<PurchaseDetails>>? _purchaseSubscription;
  /// 마지막으로 구매/복원을 시작한 화면의 완료 콜백. 리스너 자체는
  /// 한 번만 붙고 이 참조만 갈아끼운다 (`_ensureListener` 참고).
  Future<void> Function()? _onSynced;
  // Broadcast so multiple screens could listen (today only the
  // subscription screen does, but the Quiz paywall surfaces purchase
  // errors too eventually).
  final StreamController<PurchaseFailure> _errors =
      StreamController<PurchaseFailure>.broadcast();
  Stream<PurchaseFailure> get errors => _errors.stream;

  /// In-flight + recently-verified transaction IDs. StoreKit on iOS
  /// fires the same `purchased`/`restored` event multiple times per
  /// app launch (especially via restorePurchases), and each one would
  /// otherwise hammer /verify with the same JWS. Server-side dedupe
  /// catches it too, but skipping the request entirely cuts cost and
  /// audit-log noise. Cleared per process — a fresh launch can re-
  /// verify the same txn to confirm state.
  final Set<String> _verifiedTxnIds = <String>{};

  PurchaseService(
    this._ref,
    this._subscriptionRepository,
    this._appConfigRepository,
    this._analytics,
    this._inAppPurchase,
  );

  Future<PurchaseCatalog> loadCatalog() async {
    final remoteConfig = await _appConfigRepository.getPublicConfig();
    final isAvailable = await _inAppPurchase.isAvailable();
    if (!isAvailable || !remoteConfig.billingEnabled) {
      return PurchaseCatalog(
        isAvailable: false,
        productId: remoteConfig.premiumMonthlyProductId,
        products: [],
        notFoundIds: [],
        trialEnabled: remoteConfig.trialEnabled,
        trialDays: remoteConfig.trialDays,
      );
    }

    final response = await _inAppPurchase.queryProductDetails({
      remoteConfig.premiumMonthlyProductId,
    });

    return PurchaseCatalog(
      isAvailable: true,
      productId: remoteConfig.premiumMonthlyProductId,
      products: response.productDetails,
      notFoundIds: response.notFoundIDs,
      trialEnabled: remoteConfig.trialEnabled,
      trialDays: remoteConfig.trialDays,
    );
  }

  Future<void> buyPremium({
    required ProductDetails product,
    required Future<void> Function() onSynced,
  }) async {
    await _ensureListener(onSynced);
    _analytics.logPurchaseInitiated(product.id);
    final purchaseParam = PurchaseParam(productDetails: product);
    await _inAppPurchase.buyNonConsumable(purchaseParam: purchaseParam);
  }

  Future<void> restorePurchases({
    required Future<void> Function() onSynced,
  }) async {
    await _ensureListener(onSynced);
    await _inAppPurchase.restorePurchases();
  }

  /// purchaseStream 구독은 프로세스당 **한 번만** 만든다. 예전엔 호출
  /// 때마다 cancel 후 재구독했는데, `await cancel()`이 이벤트 루프에
  /// 양보하는 사이 도착한 purchase 업데이트가 통째로 유실될 수 있었다
  /// (콜드런치 자동 복원 / 구독 화면 / 퀴즈 페이월 3곳에서 호출됨).
  /// 화면마다 달라지는 건 완료 콜백뿐이므로 그것만 교체한다.
  Future<void> _ensureListener(Future<void> Function() onSynced) async {
    _onSynced = onSynced;
    if (_purchaseSubscription != null) return;
    _purchaseSubscription = _inAppPurchase.purchaseStream.listen((
      purchases,
    ) async {
      for (final purchase in purchases) {
        try {
          // 이벤트 도착 시점의 최신 콜백을 쓴다.
          await _handlePurchase(purchase, _onSynced ?? () async {});
        } on PurchaseFailure catch (e) {
          // Pipe the failure out to the UI. Without this, errors
          // thrown inside the stream listener escape unhandled —
          // user sees no feedback and the spinner has already stopped.
          if (!_errors.isClosed) _errors.add(e);
        } catch (e, st) {
          developer.log(
            'Unhandled purchase event error',
            name: 'PurchaseService',
            error: e,
            stackTrace: st,
          );
          if (!_errors.isClosed) {
            _errors.add(PurchaseFailure('알 수 없는 오류가 발생했어요.'));
          }
        }
      }
    });
  }

  /// Process a single purchase update. The critical rule: NEVER call
  /// `completePurchase` until server verification succeeds — once the
  /// transaction leaves the store queue we lose the only retry handle
  /// the user has, so a server outage at that moment would leave them
  /// charged but un-premium.
  Future<void> _handlePurchase(
    PurchaseDetails purchase,
    Future<void> Function() onSynced,
  ) async {
    switch (purchase.status) {
      case PurchaseStatus.purchased:
      case PurchaseStatus.restored:
        // Skip if this exact transaction was already verified this
        // session — the stream re-fires the same events on launch and
        // restore. `purchaseID` is the per-transaction id (iOS:
        // transactionId, Android: orderId), which is what we want for
        // dedupe (a renewal gets a new id and re-verifies correctly).
        final txnKey = purchase.purchaseID;
        if (txnKey != null && _verifiedTxnIds.contains(txnKey)) {
          if (purchase.pendingCompletePurchase) {
            await _inAppPurchase.completePurchase(purchase);
          }
          return;
        }
        try {
          await _subscriptionRepository.verifyPurchase(
            productId: purchase.productID,
            source: Platform.isIOS ? 'app_store' : 'play_store',
            serverVerificationData:
                purchase.verificationData.serverVerificationData,
          );
          if (txnKey != null) _verifiedTxnIds.add(txnKey);
        } catch (e) {
          // Server verification failed. Leave the transaction in the
          // store queue so the next app launch / restore retries —
          // unless the server explicitly said the request is bad
          // (4xx), in which case retrying won't help and the user
          // needs to see WHY (e.g. "subscription tied to another
          // account").
          developer.log(
            'verifyPurchase failed: $e',
            name: 'PurchaseService',
            error: e,
          );
          if (e is DioException) {
            final status = e.response?.statusCode ?? 0;
            // Pull the server's human message when present; falls
            // back to a generic one for transport errors.
            final serverMessage =
                e.response?.data is Map<String, dynamic>
                    ? (e.response!.data as Map<String, dynamic>)['message']
                          ?.toString()
                    : null;
            if (status >= 400 && status < 500 &&
                !_retriableStatuses.contains(status)) {
              // Permanent failure — clear the store queue so the
              // user can retry / take action without being stuck.
              if (purchase.pendingCompletePurchase) {
                await _inAppPurchase.completePurchase(purchase);
              }
              _analytics.logPurchaseFailed('verify_4xx_$status');
              throw PurchaseFailure(
                serverMessage ?? '결제 검증을 거부당했어요.',
              );
            }
          }
          _analytics.logPurchaseFailed('verify_transient');
          throw PurchaseFailure('결제 검증에 실패했어요. 잠시 후 다시 시도해 주세요.');
        }
        // Only NOW take it off the queue.
        if (purchase.pendingCompletePurchase) {
          await _inAppPurchase.completePurchase(purchase);
        }
        _analytics.logPurchaseCompleted(purchase.productID);
        // 위젯 lifecycle과 무관하게 provider invalidate — 구독 화면을
        // 뒤로갔어도 AppShell/다른 화면이 premium 상태를 즉시 반영.
        // 이전엔 onSynced가 disposed widget의 ref에 묶여 invalidate가
        // no-op이라 UI가 free state로 stuck됐음.
        _ref.invalidate(subscriptionStatusProvider);
        try {
          await _ref.read(authStateProvider.notifier).refreshCurrentUser();
        } catch (_) {
          // auth 새로고침 실패는 silent — premium 권한은
          // subscriptionStatusProvider가 reflect.
        }
        // 화면이 살아있을 때만 의미 있는 callback (spinner stop 등).
        // disposed면 내부에서 무해하게 fail.
        try {
          await onSynced();
        } catch (_) {}
        return;

      case PurchaseStatus.error:
        developer.log(
          'PurchaseStatus.error: ${purchase.error?.message}',
          name: 'PurchaseService',
        );
        // Clear the queue so the user can retry. The store has already
        // refunded any partial charge for an `error` state.
        if (purchase.pendingCompletePurchase) {
          await _inAppPurchase.completePurchase(purchase);
        }
        throw PurchaseFailure(
          purchase.error?.message ?? '결제가 완료되지 않았어요.',
        );

      case PurchaseStatus.canceled:
        if (purchase.pendingCompletePurchase) {
          await _inAppPurchase.completePurchase(purchase);
        }
        // User cancellation isn't an error — just swallow it.
        return;

      case PurchaseStatus.pending:
        // Waiting on the store (e.g. SCA / family approval). Don't
        // touch completePurchase yet; we'll get a follow-up event.
        return;
    }
  }

  /// 로그인/로그아웃 경계에서 사용자 종속 캐시를 비운다.
  ///
  /// PurchaseService는 앱 수명 내내 살아있는 Provider라 계정을 바꿔도
  /// 인스턴스가 그대로다. `_verifiedTxnIds`를 남겨두면 A가 검증한
  /// 트랜잭션을 B 로그인 후 restore가 "이미 처리함"으로 건너뛰어,
  /// B는 프리미엄도 못 받고 "다른 계정에 연결돼 있다"는 서버 안내조차
  /// 못 본다(앱을 완전히 재시작해야 풀림). `_onSynced`도 사라진 화면의
  /// 콜백이라 함께 비운다. 리스너 자체는 유지 — 진행 중인 구매 이벤트를
  /// 놓치지 않기 위함.
  void resetUserScopedCache() {
    _verifiedTxnIds.clear();
    _onSynced = null;
  }

  Future<void> dispose() async {
    await _purchaseSubscription?.cancel();
    _purchaseSubscription = null;
    _onSynced = null;
    await _errors.close();
  }
}
