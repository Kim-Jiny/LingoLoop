import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/subscription_repository.dart';

/// 사용자 구독 상태 단일 진입점. premium 여부 / 만료일 / store 정보 등.
///
/// `subscription_provider.dart`가 아닌 이 파일에 단독으로 둔 이유:
/// `purchase_service`가 verify 성공 시 이 provider를 invalidate해야
/// 하는데, `subscription_provider.dart`(에 있는 `purchaseCatalogProvider`)
/// 가 `purchase_service`를 import하고 있어 순환 import가 됨. 이 작은
/// provider만 따로 분리해 purchase_service가 import할 file을 좁힘.
final subscriptionStatusProvider = FutureProvider<SubscriptionStatus>((
  ref,
) async {
  final repo = ref.read(subscriptionRepositoryProvider);
  return repo.getStatus();
});
