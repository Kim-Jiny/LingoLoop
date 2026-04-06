import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/purchase_service.dart';
import '../data/subscription_repository.dart';

final subscriptionStatusProvider = FutureProvider<SubscriptionStatus>((
  ref,
) async {
  final repo = ref.read(subscriptionRepositoryProvider);
  return repo.getStatus();
});

final purchaseCatalogProvider = FutureProvider<PurchaseCatalog>((ref) async {
  final service = ref.read(purchaseServiceProvider);
  return service.loadCatalog();
});
