import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/purchase_service.dart';
// subscriptionStatusProvider는 별도 파일로 분리됐지만 이 파일이
// 단일 진입점이라 re-export — 기존 consumer는 변경 없이 그대로 사용.
export 'subscription_status_provider.dart';

final purchaseCatalogProvider = FutureProvider<PurchaseCatalog>((ref) async {
  final service = ref.read(purchaseServiceProvider);
  return service.loadCatalog();
});
