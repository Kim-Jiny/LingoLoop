// PurchaseCatalog의 Android offer 선택 / 가격 표시 로직 테스트.
//
// 이게 왜 중요한가: Android는 구독 productId 하나에 대해 offer 개수만큼
// ProductDetails를 돌려주고, 그중 어느 것을 PurchaseParam에 넘기느냐가
// "어떤 offer로 결제되는지"를 결정한다. 순서는 Google이 보장하지 않는다.
// 인덱스 0을 그냥 집던 예전 구현은 Play에 무료체험 offer를 등록하는
// 순간 (a) 체험 없이 즉시 결제되거나 (b) 화면에 0원이 고지되는 상태가
// 됐다. 실기기 없이 재현되지 않는 종류라 단위 테스트로 못박아 둔다.

import 'package:flutter_test/flutter_test.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/billing_client_wrappers.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';
import 'package:lingoloop/features/subscription/data/purchase_service.dart';

const String kProductId = 'premium_monthly';

PricingPhaseWrapper _freeTrialPhase() => const PricingPhaseWrapper(
  billingCycleCount: 1,
  billingPeriod: 'P1W',
  formattedPrice: '₩0',
  priceAmountMicros: 0,
  priceCurrencyCode: 'KRW',
  recurrenceMode: RecurrenceMode.finiteRecurring,
);

PricingPhaseWrapper _recurringPhase() => const PricingPhaseWrapper(
  billingCycleCount: 0,
  billingPeriod: 'P1M',
  formattedPrice: '₩3,900',
  priceAmountMicros: 3900000000,
  priceCurrencyCode: 'KRW',
  recurrenceMode: RecurrenceMode.infiniteRecurring,
);

/// [withTrial]이 true면 무료체험 offer가 base plan **앞**에 오는
/// 순서로 만든다 — 예전 구현이 0원을 표시하던 배치.
/// [trialLast]면 뒤에 붙인다 — 예전 구현이 체험을 건너뛰고 결제하던 배치.
List<ProductDetails> _androidProducts({
  required bool withTrial,
  bool trialLast = false,
}) {
  final basePlan = SubscriptionOfferDetailsWrapper(
    basePlanId: 'monthly',
    offerTags: const <String>[],
    offerIdToken: 'token-base',
    pricingPhases: <PricingPhaseWrapper>[_recurringPhase()],
  );
  final trialOffer = SubscriptionOfferDetailsWrapper(
    basePlanId: 'monthly',
    offerId: 'freetrial7',
    offerTags: const <String>[],
    offerIdToken: 'token-trial',
    pricingPhases: <PricingPhaseWrapper>[_freeTrialPhase(), _recurringPhase()],
  );

  final offers = <SubscriptionOfferDetailsWrapper>[
    if (withTrial && !trialLast) trialOffer,
    basePlan,
    if (withTrial && trialLast) trialOffer,
  ];

  return GooglePlayProductDetails.fromProductDetails(
    ProductDetailsWrapper(
      description: '프리미엄 월 구독',
      name: '프리미엄',
      productId: kProductId,
      productType: ProductType.subs,
      subscriptionOfferDetails: offers,
      title: '프리미엄 (LingoLoop)',
    ),
  );
}

PurchaseCatalog _catalog(List<ProductDetails> products, {bool trial = true}) =>
    PurchaseCatalog(
      isAvailable: true,
      productId: kProductId,
      products: products,
      notFoundIds: const <String>[],
      trialEnabled: trial,
      trialDays: 7,
    );

void main() {
  group('Android 구독 offer 선택', () {
    test('무료체험 offer가 목록 뒤에 있어도 그걸 고른다', () {
      // 예전 구현은 인덱스 0(base plan)을 집어 체험 없이 결제시켰다.
      final catalog = _catalog(
        _androidProducts(withTrial: true, trialLast: true),
      );
      final product = catalog.premiumProduct;

      expect(product, isA<GooglePlayProductDetails>());
      expect(
        (product! as GooglePlayProductDetails).offerToken,
        'token-trial',
        reason: '체험 offer의 offerToken으로 결제돼야 함',
      );
    });

    test('무료체험 offer가 앞에 있어도 동일하게 고른다', () {
      final catalog = _catalog(_androidProducts(withTrial: true));
      expect(
        (catalog.premiumProduct! as GooglePlayProductDetails).offerToken,
        'token-trial',
      );
    });

    test('체험 offer가 없으면 base plan으로 떨어진다', () {
      final catalog = _catalog(_androidProducts(withTrial: false));
      expect(
        (catalog.premiumProduct! as GooglePlayProductDetails).offerToken,
        'token-base',
      );
    });

    test('productId가 다른 상품은 무시한다', () {
      final catalog = PurchaseCatalog(
        isAvailable: true,
        productId: 'no_such_product',
        products: _androidProducts(withTrial: true),
        notFoundIds: const <String>[],
      );
      expect(catalog.premiumProduct, isNull);
      expect(catalog.premiumPriceLabel, isNull);
    });
  });

  group('표시 가격', () {
    test('체험 offer를 골랐어도 정가를 표시한다', () {
      // 회귀 방지의 핵심: ProductDetails.price는 여기서 "₩0"이다.
      final catalog = _catalog(_androidProducts(withTrial: true));
      expect(catalog.premiumProduct!.price, '₩0');
      expect(catalog.premiumPriceLabel, '₩3,900');
    });

    test('체험이 없으면 base plan 가격 그대로', () {
      final catalog = _catalog(_androidProducts(withTrial: false));
      expect(catalog.premiumPriceLabel, '₩3,900');
    });
  });

  group('storeTrialAvailable', () {
    test('스토어가 체험 offer를 내려주면 true', () {
      expect(_catalog(_androidProducts(withTrial: true)).storeTrialAvailable,
          isTrue);
    });

    test('remote config가 켜져 있어도 스토어에 offer가 없으면 false', () {
      // 체험을 이미 소진한 사용자에게 Play는 base plan만 내려준다.
      // 이때 "7일 무료체험 시작" 문구를 띄우면 거짓 고지가 된다.
      expect(
        _catalog(_androidProducts(withTrial: false), trial: true)
            .storeTrialAvailable,
        isFalse,
      );
    });

    test('상품이 없으면 remote config 값을 따른다', () {
      final empty = PurchaseCatalog(
        isAvailable: false,
        productId: kProductId,
        products: const <ProductDetails>[],
        notFoundIds: const <String>[kProductId],
        trialEnabled: true,
      );
      expect(empty.storeTrialAvailable, isTrue);
    });
  });
}
