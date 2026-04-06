import 'dart:async';
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
        if (purchase.status == PurchaseStatus.purchased ||
            purchase.status == PurchaseStatus.restored) {
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
          await onSynced();
        }

        if (purchase.pendingCompletePurchase) {
          await _inAppPurchase.completePurchase(purchase);
        }
      }
    });
  }

  Future<void> dispose() async {
    await _purchaseSubscription?.cancel();
  }
}
