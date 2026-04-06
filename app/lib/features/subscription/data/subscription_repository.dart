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

  Future<SubscriptionStatus> verifyPurchase({
    required String productId,
    required String purchaseId,
    required String? transactionDate,
    required String source,
    required String status,
    required String serverVerificationData,
    required String localVerificationData,
    required bool isRestore,
  }) async {
    final response = await _dio.post(
      ApiConstants.subscriptionVerify,
      data: {
        'productId': productId,
        'purchaseId': purchaseId,
        'transactionDate': transactionDate,
        'source': source,
        'status': status,
        'serverVerificationData': serverVerificationData,
        'localVerificationData': localVerificationData,
        'isRestore': isRestore,
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
  final String subscriptionTier;
  final int displayPriceKrw;
  final String billingMode;

  SubscriptionStatus({
    required this.plan,
    required this.isActive,
    required this.expiresAt,
    required this.store,
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
      subscriptionTier: json['subscriptionTier'] ?? 'free',
      displayPriceKrw: json['displayPriceKrw'] ?? 3000,
      billingMode: json['billingMode'] ?? 'mock',
    );
  }

  bool get isPremium => subscriptionTier == 'premium';
}
