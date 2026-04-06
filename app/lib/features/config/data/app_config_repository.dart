import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final appConfigRepositoryProvider = Provider<AppConfigRepository>((ref) {
  return AppConfigRepository(ref.read(dioProvider));
});

class AppConfigRepository {
  final Dio _dio;

  AppConfigRepository(this._dio);

  Future<AppRemoteConfig> getPublicConfig() async {
    final response = await _dio.get('/api/admin/app-config/public');
    return AppRemoteConfig.fromJson(response.data);
  }
}

class AppRemoteConfig {
  final String premiumMonthlyProductId;
  final bool billingEnabled;
  final String? iosProductGroupId;
  final String? androidBasePlanId;

  AppRemoteConfig({
    required this.premiumMonthlyProductId,
    required this.billingEnabled,
    required this.iosProductGroupId,
    required this.androidBasePlanId,
  });

  factory AppRemoteConfig.fromJson(Map<String, dynamic> json) {
    return AppRemoteConfig(
      premiumMonthlyProductId:
          json['premiumMonthlyProductId'] ?? 'lingoloop_premium_monthly',
      billingEnabled: json['billingEnabled'] ?? false,
      iosProductGroupId: json['iosProductGroupId'],
      androidBasePlanId: json['androidBasePlanId'],
    );
  }
}
