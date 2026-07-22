// PurchaseService의 검증 실패 처리 / 트랜잭션 중복 제거 테스트.
//
// 여기서 지키려는 세 가지:
//
//  1. **인증 문제(401/403)로 트랜잭션을 큐에서 지우지 않는다.**
//     `completePurchase`를 부르는 순간 사용자가 가진 유일한 재시도
//     수단이 사라진다. 401은 영수증이 잘못됐다는 뜻이 아니라 이쪽
//     세션 문제이므로 큐에 남겨 다음 실행에서 다시 검증해야 한다.
//
//  2. **서버가 영수증 자체를 거부한 4xx는 큐를 비운다.** 안 그러면
//     "다른 계정에 연결됨" 같은 영구 실패에서 사용자가 영원히 같은
//     오류만 반복해 본다.
//
//  3. **계정을 바꾸면 검증 캐시가 리셋된다.** PurchaseService는 앱
//     수명 provider라 A가 검증한 트랜잭션 id가 남아 있으면 B 로그인
//     후 복원이 통째로 무시된다.
//
// 실기기 + 스토어 계정 없이는 재현이 불가능한 경로들이라 스토어 SDK를
// 통째로 대역으로 세운다.

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:lingoloop/core/analytics/analytics_service.dart';
import 'package:lingoloop/features/auth/domain/auth_provider.dart';
import 'package:lingoloop/features/auth/domain/auth_model.dart';
import 'package:lingoloop/features/config/data/app_config_repository.dart';
import 'package:lingoloop/features/subscription/data/purchase_service.dart';
import 'package:lingoloop/features/subscription/data/subscription_repository.dart';
import 'package:mocktail/mocktail.dart';

class MockInAppPurchase extends Mock implements InAppPurchase {}

class MockSubscriptionRepository extends Mock implements SubscriptionRepository {}

class MockAppConfigRepository extends Mock implements AppConfigRepository {}

class MockAnalyticsService extends Mock implements AnalyticsService {}

/// authStateProvider를 대역으로 세운다 — 검증 성공 경로가
/// `refreshCurrentUser()`를 부르는데, 진짜 notifier는 secure storage와
/// 네트워크를 건드린다.
class FakeAuthNotifier extends AuthNotifier {
  @override
  Future<UserInfo?> build() async => null;

  @override
  Future<void> refreshCurrentUser() async {}
}

PurchaseDetails _purchase({
  required String id,
  String productId = 'premium_monthly',
  PurchaseStatus status = PurchaseStatus.purchased,
  bool pendingComplete = true,
}) {
  return PurchaseDetails(
    purchaseID: id,
    productID: productId,
    verificationData: PurchaseVerificationData(
      localVerificationData: 'local-$id',
      serverVerificationData: 'server-$id',
      source: 'play_store',
    ),
    transactionDate: '1700000000000',
    status: status,
  )..pendingCompletePurchase = pendingComplete;
}

DioException _httpError(int status) {
  final options = RequestOptions(path: '/api/subscriptions/verify');
  return DioException(
    requestOptions: options,
    type: DioExceptionType.badResponse,
    response: Response<dynamic>(
      requestOptions: options,
      statusCode: status,
      data: <String, dynamic>{'message': '서버 메시지 $status'},
    ),
  );
}

SubscriptionStatus _activeStatus() => SubscriptionStatus.fromJson(
  <String, dynamic>{
    'plan': 'premium',
    'isActive': true,
    'subscriptionTier': 'premium',
  },
);

void main() {
  late MockInAppPurchase iap;
  late MockSubscriptionRepository repo;
  late MockAnalyticsService analytics;
  late StreamController<List<PurchaseDetails>> purchases;
  late ProviderContainer container;

  setUpAll(() {
    registerFallbackValue(_purchase(id: 'fallback'));
  });

  setUp(() {
    iap = MockInAppPurchase();
    repo = MockSubscriptionRepository();
    analytics = MockAnalyticsService();
    purchases = StreamController<List<PurchaseDetails>>.broadcast();

    when(() => iap.purchaseStream).thenAnswer((_) => purchases.stream);
    when(() => iap.restorePurchases()).thenAnswer((_) async {});
    when(() => iap.completePurchase(any())).thenAnswer((_) async {});
    when(() => repo.getStatus()).thenAnswer((_) async => _activeStatus());
    when(() => analytics.logPurchaseCompleted(any())).thenAnswer((_) async {});
    when(() => analytics.logPurchaseFailed(any())).thenAnswer((_) async {});
    when(() => analytics.logPurchaseInitiated(any())).thenAnswer((_) async {});

    container = ProviderContainer(
      overrides: [
        inAppPurchaseProvider.overrideWithValue(iap),
        subscriptionRepositoryProvider.overrideWithValue(repo),
        appConfigRepositoryProvider.overrideWithValue(MockAppConfigRepository()),
        analyticsServiceProvider.overrideWithValue(analytics),
        authStateProvider.overrideWith(FakeAuthNotifier.new),
      ],
    );
  });

  tearDown(() {
    purchases.close();
    container.dispose();
  });

  /// 서비스에 리스너를 붙이고 purchase 이벤트 하나를 흘려보낸 뒤,
  /// 비동기 처리가 끝날 때까지 기다린다.
  Future<PurchaseService> emit(PurchaseDetails purchase) async {
    final service = container.read(purchaseServiceProvider);
    await service.restorePurchases(onSynced: () async {});
    purchases.add(<PurchaseDetails>[purchase]);
    // 리스너 콜백이 async라 이벤트 루프를 몇 바퀴 돌려준다.
    await pumpEventQueue();
    return service;
  }

  group('검증 실패 분류', () {
    test('401이면 트랜잭션을 큐에 남긴다', () async {
      // 회귀 방지의 핵심: 여기서 completePurchase를 부르면 결제한
      // 사용자가 재시도 수단을 잃는다.
      when(
        () => repo.verifyPurchase(
          productId: any(named: 'productId'),
          source: any(named: 'source'),
          serverVerificationData: any(named: 'serverVerificationData'),
        ),
      ).thenThrow(_httpError(401));

      await emit(_purchase(id: 'txn-401'));

      verifyNever(() => iap.completePurchase(any()));
      verify(() => analytics.logPurchaseFailed('verify_transient')).called(1);
    });

    test('403도 큐에 남긴다', () async {
      when(
        () => repo.verifyPurchase(
          productId: any(named: 'productId'),
          source: any(named: 'source'),
          serverVerificationData: any(named: 'serverVerificationData'),
        ),
      ).thenThrow(_httpError(403));

      await emit(_purchase(id: 'txn-403'));

      verifyNever(() => iap.completePurchase(any()));
    });

    test('429도 큐에 남긴다', () async {
      when(
        () => repo.verifyPurchase(
          productId: any(named: 'productId'),
          source: any(named: 'source'),
          serverVerificationData: any(named: 'serverVerificationData'),
        ),
      ).thenThrow(_httpError(429));

      await emit(_purchase(id: 'txn-429'));

      verifyNever(() => iap.completePurchase(any()));
    });

    test('5xx도 큐에 남긴다', () async {
      when(
        () => repo.verifyPurchase(
          productId: any(named: 'productId'),
          source: any(named: 'source'),
          serverVerificationData: any(named: 'serverVerificationData'),
        ),
      ).thenThrow(_httpError(503));

      await emit(_purchase(id: 'txn-503'));

      verifyNever(() => iap.completePurchase(any()));
    });

    test('409(다른 계정에 연결됨)는 영구 실패로 큐를 비운다', () async {
      // 이건 재시도해도 절대 풀리지 않으므로 큐에 남기면 사용자가
      // 같은 오류만 무한히 본다.
      when(
        () => repo.verifyPurchase(
          productId: any(named: 'productId'),
          source: any(named: 'source'),
          serverVerificationData: any(named: 'serverVerificationData'),
        ),
      ).thenThrow(_httpError(409));

      await emit(_purchase(id: 'txn-409'));

      verify(() => iap.completePurchase(any())).called(1);
      verify(() => analytics.logPurchaseFailed('verify_4xx_409')).called(1);
    });

    test('400(알 수 없는 상품)도 영구 실패로 큐를 비운다', () async {
      when(
        () => repo.verifyPurchase(
          productId: any(named: 'productId'),
          source: any(named: 'source'),
          serverVerificationData: any(named: 'serverVerificationData'),
        ),
      ).thenThrow(_httpError(400));

      await emit(_purchase(id: 'txn-400'));

      verify(() => iap.completePurchase(any())).called(1);
    });
  });

  group('검증 성공', () {
    setUp(() {
      when(
        () => repo.verifyPurchase(
          productId: any(named: 'productId'),
          source: any(named: 'source'),
          serverVerificationData: any(named: 'serverVerificationData'),
        ),
      ).thenAnswer((_) async => _activeStatus());
    });

    test('검증 후에 큐를 비운다', () async {
      await emit(_purchase(id: 'txn-ok'));

      verify(() => iap.completePurchase(any())).called(1);
      verify(() => analytics.logPurchaseCompleted('premium_monthly')).called(1);
    });

    test('같은 트랜잭션이 다시 와도 재검증하지 않는다', () async {
      // StoreKit은 실행마다 같은 이벤트를 여러 번 쏜다.
      final service = await emit(_purchase(id: 'txn-dup'));
      purchases.add(<PurchaseDetails>[_purchase(id: 'txn-dup')]);
      await pumpEventQueue();

      expect(service, isNotNull);
      verify(
        () => repo.verifyPurchase(
          productId: any(named: 'productId'),
          source: any(named: 'source'),
          serverVerificationData: any(named: 'serverVerificationData'),
        ),
      ).called(1);
    });

    test('계정이 바뀌면(resetUserScopedCache) 같은 트랜잭션을 다시 검증한다', () async {
      // A가 검증한 id가 남아 있으면 B 로그인 후 복원이 통째로 무시돼
      // B는 프리미엄도, "다른 계정에 연결됨" 안내도 못 받는다.
      final service = await emit(_purchase(id: 'txn-switch'));

      service.resetUserScopedCache();
      purchases.add(<PurchaseDetails>[_purchase(id: 'txn-switch')]);
      await pumpEventQueue();

      verify(
        () => repo.verifyPurchase(
          productId: any(named: 'productId'),
          source: any(named: 'source'),
          serverVerificationData: any(named: 'serverVerificationData'),
        ),
      ).called(2);
    });
  });

  group('리스너 수명', () {
    test('구매/복원을 여러 번 호출해도 스트림을 다시 구독하지 않는다', () async {
      // 예전엔 호출마다 cancel 후 재구독했다. `await cancel()`이
      // 이벤트 루프에 양보하는 그 틈에 도착한 purchase 업데이트는
      // 통째로 유실된다 — 결제는 됐는데 프리미엄이 안 켜지는 경로다.
      //
      // 유실 자체는 타이밍에 달려 있어 결정적으로 재현할 수 없으므로,
      // 원인인 "재구독"을 센다. purchaseStream을 몇 번 읽었는지가
      // 곧 구독을 몇 번 만들었는지다.
      final service = container.read(purchaseServiceProvider);
      await service.restorePurchases(onSynced: () async {});
      await service.restorePurchases(onSynced: () async {});
      await service.restorePurchases(onSynced: () async {});

      verify(() => iap.purchaseStream).called(1);
      // 호출은 세 번 다 실제로 스토어까지 갔어야 한다 (리스너를
      // 재사용한다고 복원 자체를 건너뛰면 안 됨).
      verify(() => iap.restorePurchases()).called(3);
    });

    test('완료 콜백은 가장 최근 호출자의 것으로 교체된다', () async {
      // 리스너를 한 번만 붙이는 대신 콜백만 갈아끼우므로, 나중에
      // 구매를 시작한 화면이 완료 통지를 받아야 한다.
      when(
        () => repo.verifyPurchase(
          productId: any(named: 'productId'),
          source: any(named: 'source'),
          serverVerificationData: any(named: 'serverVerificationData'),
        ),
      ).thenAnswer((_) async => _activeStatus());

      var firstCalled = false;
      var secondCalled = false;
      final service = container.read(purchaseServiceProvider);
      await service.restorePurchases(onSynced: () async => firstCalled = true);
      await service.restorePurchases(onSynced: () async => secondCalled = true);

      purchases.add(<PurchaseDetails>[_purchase(id: 'txn-callback')]);
      await pumpEventQueue();

      expect(firstCalled, isFalse, reason: '오래된 화면의 콜백');
      expect(secondCalled, isTrue, reason: '가장 최근 호출자의 콜백');
    });
  });
}
