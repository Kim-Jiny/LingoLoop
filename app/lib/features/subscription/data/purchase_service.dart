import 'dart:async';
import 'dart:developer' as developer;
import 'dart:io';

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
        await _handlePurchase(purchase, onSynced);
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
            purchaseId: purchase.purchaseID ?? '',
            transactionDate: purchase.transactionDate,
            source: Platform.isIOS ? 'app_store' : 'play_store',
            status: purchase.status.name,
            serverVerificationData:
                purchase.verificationData.serverVerificationData,
            localVerificationData:
                purchase.verificationData.localVerificationData,
            isRestore: purchase.status == PurchaseStatus.restored,
          );
        } catch (e) {
          // Server verification failed. Leave the transaction in the
          // store queue so the next app launch / restore retries.
          developer.log(
            'verifyPurchase failed: $e',
            name: 'PurchaseService',
            error: e,
          );
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
  }
}
