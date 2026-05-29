import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';

final subscriptionRepositoryProvider = Provider<SubscriptionRepository>((ref) {
  return SubscriptionRepository(ref.read(dioProvider));
});

class SubscriptionRepository {
  final Dio _dio;

  SubscriptionRepository(this._dio);

  Future<SubscriptionStatus> getStatus() async {
    final response = await _dio.get(ApiConstants.subscriptionMe);
    return SubscriptionStatus.fromJson(response.data);
  }

  /// Hands the store-side verification blob to the server. iOS sends
  /// the StoreKit 2 JWSRepresentation; Android sends the Play Billing
  /// purchaseToken. Server re-verifies against Apple's chain or the
  /// Play Developer API and returns the authoritative status.
  Future<List<SubscriptionHistoryItem>> getHistory() async {
    final response = await _dio.get(ApiConstants.subscriptionHistory);
    final items = response.data['items'] as List? ?? [];
    return items
        .map((e) => SubscriptionHistoryItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<SubscriptionStatus> verifyPurchase({
    required String productId,
    required String source,
    required String serverVerificationData,
  }) async {
    final response = await _dio.post(
      ApiConstants.subscriptionVerify,
      data: {
        'productId': productId,
        'source': source,
        'serverVerificationData': serverVerificationData,
      },
    );
    return SubscriptionStatus.fromJson(response.data);
  }
}

class SubscriptionStatus {
  final String plan;
  final bool isActive;
  final String? expiresAt;
  final String store;
  final String? productId;
  final bool autoRenew;
  final bool inTrial;
  final String? environment;
  final String subscriptionTier;
  final int displayPriceKrw;
  final String billingMode;

  SubscriptionStatus({
    required this.plan,
    required this.isActive,
    required this.expiresAt,
    required this.store,
    required this.productId,
    required this.autoRenew,
    required this.inTrial,
    required this.environment,
    required this.subscriptionTier,
    required this.displayPriceKrw,
    required this.billingMode,
  });

  factory SubscriptionStatus.fromJson(Map<String, dynamic> json) {
    return SubscriptionStatus(
      plan: json['plan'] ?? 'free',
      isActive: json['isActive'] ?? false,
      expiresAt: json['expiresAt'],
      store: json['store'] ?? 'mock',
      productId: json['productId'],
      autoRenew: json['autoRenew'] ?? false,
      inTrial: json['inTrial'] ?? false,
      environment: json['environment'],
      subscriptionTier: json['subscriptionTier'] ?? 'free',
      displayPriceKrw: json['displayPriceKrw'] ?? 3900,
      billingMode: json['billingMode'] ?? 'mock',
    );
  }

  bool get isPremium => subscriptionTier == 'premium';
}

/// 사용자 본인 구독 이력 한 줄. 서버의 normalized event 응답.
class SubscriptionHistoryItem {
  final DateTime occurredAt;
  /// purchase / renew / cancel / resume / refund / expire / trial
  final String kind;
  final String? productId;
  final DateTime? expiresAt;
  final String label;
  final String? note;

  SubscriptionHistoryItem({
    required this.occurredAt,
    required this.kind,
    required this.label,
    this.productId,
    this.expiresAt,
    this.note,
  });

  factory SubscriptionHistoryItem.fromJson(Map<String, dynamic> json) {
    DateTime? parseDt(dynamic v) {
      if (v == null) return null;
      return DateTime.tryParse(v.toString());
    }

    return SubscriptionHistoryItem(
      occurredAt: parseDt(json['occurredAt']) ?? DateTime.now(),
      kind: (json['kind'] ?? '').toString(),
      productId: json['productId'],
      expiresAt: parseDt(json['expiresAt']),
      label: (json['label'] ?? '').toString(),
      note: json['note'],
    );
  }
}
