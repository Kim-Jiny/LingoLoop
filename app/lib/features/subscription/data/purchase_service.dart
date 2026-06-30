import 'dart:async';
import 'dart:developer' as developer;
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import '../../../core/analytics/analytics_service.dart';
import '../../auth/domain/auth_provider.dart';
import '../../config/data/app_config_repository.dart';
import '../domain/subscription_status_provider.dart';
import 'subscription_repository.dart';

final purchaseServiceProvider = Provider<PurchaseService>((ref) {
  final service = PurchaseService(
    ref,
    ref.read(subscriptionRepositoryProvider),
    ref.read(appConfigRepositoryProvider),
    ref.read(analyticsServiceProvider),
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

  ProductDetails? get premiumProduct => products
      .cast<ProductDetails?>()
      .firstWhere((product) => product?.id == productId, orElse: () => null);
}

class PurchaseService {
  /// Provider-scoped Ref — 위젯 lifecycle과 독립. 구독 화면을 뒤로가도
  /// purchase stream listener는 살아있고, verify 성공 시 직접
  /// subscriptionStatusProvider를 invalidate해서 UI가 동기화되게.
  final Ref _ref;
  final InAppPurchase _inAppPurchase = InAppPurchase.instance;
  final SubscriptionRepository _subscriptionRepository;
  final AppConfigRepository _appConfigRepository;
  final AnalyticsService _analytics;
  StreamSubscription<List<PurchaseDetails>>? _purchaseSubscription;
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

  Future<void> _ensureListener(Future<void> Function() onSynced) async {
    await _purchaseSubscription?.cancel();
    _purchaseSubscription = _inAppPurchase.purchaseStream.listen((
      purchases,
    ) async {
      for (final purchase in purchases) {
        try {
          await _handlePurchase(purchase, onSynced);
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
            if (status >= 400 && status < 500) {
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

  Future<void> dispose() async {
    await _purchaseSubscription?.cancel();
    await _errors.close();
  }
}
