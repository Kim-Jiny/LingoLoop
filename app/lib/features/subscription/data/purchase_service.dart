import 'dart:async';
import 'dart:developer' as developer;
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import '../../config/data/app_config_repository.dart';
import 'subscription_repository.dart';

final purchaseServiceProvider = Provider<PurchaseService>((ref) {
  final service = PurchaseService(
    ref.read(subscriptionRepositoryProvider),
    ref.read(appConfigRepositoryProvider),
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

  const PurchaseCatalog({
    required this.isAvailable,
    required this.productId,
    required this.products,
    required this.notFoundIds,
  });

  ProductDetails? get premiumProduct => products
      .cast<ProductDetails?>()
      .firstWhere((product) => product?.id == productId, orElse: () => null);
}

class PurchaseService {
  final InAppPurchase _inAppPurchase = InAppPurchase.instance;
  final SubscriptionRepository _subscriptionRepository;
  final AppConfigRepository _appConfigRepository;
  StreamSubscription<List<PurchaseDetails>>? _purchaseSubscription;
  // Broadcast so multiple screens could listen (today only the
  // subscription screen does, but the Quiz paywall surfaces purchase
  // errors too eventually).
  final StreamController<PurchaseFailure> _errors =
      StreamController<PurchaseFailure>.broadcast();
  Stream<PurchaseFailure> get errors => _errors.stream;

  PurchaseService(this._subscriptionRepository, this._appConfigRepository);

  Future<PurchaseCatalog> loadCatalog() async {
    final remoteConfig = await _appConfigRepository.getPublicConfig();
    final isAvailable = await _inAppPurchase.isAvailable();
    if (!isAvailable || !remoteConfig.billingEnabled) {
      return PurchaseCatalog(
        isAvailable: false,
        productId: remoteConfig.premiumMonthlyProductId,
        products: [],
        notFoundIds: [],
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
    );
  }

  Future<void> buyPremium({
    required ProductDetails product,
    required Future<void> Function() onSynced,
  }) async {
    await _ensureListener(onSynced);
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
        try {
          await _subscriptionRepository.verifyPurchase(
            productId: purchase.productID,
            source: Platform.isIOS ? 'app_store' : 'play_store',
            serverVerificationData:
                purchase.verificationData.serverVerificationData,
          );
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
              throw PurchaseFailure(
                serverMessage ?? '결제 검증을 거부당했어요.',
              );
            }
          }
          throw PurchaseFailure('결제 검증에 실패했어요. 잠시 후 다시 시도해 주세요.');
        }
        // Only NOW take it off the queue.
        if (purchase.pendingCompletePurchase) {
          await _inAppPurchase.completePurchase(purchase);
        }
        await onSynced();
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
