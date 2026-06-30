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

  /// 스토어에 무료체험 offer를 설정한 뒤 운영자가 켜는 표시 토글.
  /// true면 paywall이 "N일 무료체험" 문구로 바뀐다.
  final bool trialEnabled;

  /// 무료체험 일수 (스토어 offer 기간과 일치, 표시용).
  final int trialDays;

  AppRemoteConfig({
    required this.premiumMonthlyProductId,
    required this.billingEnabled,
    required this.iosProductGroupId,
    required this.androidBasePlanId,
    required this.trialEnabled,
    required this.trialDays,
  });

  factory AppRemoteConfig.fromJson(Map<String, dynamic> json) {
    return AppRemoteConfig(
      premiumMonthlyProductId:
          json['premiumMonthlyProductId'] ?? 'lingoloop_premium_monthly',
      billingEnabled: json['billingEnabled'] ?? false,
      iosProductGroupId: json['iosProductGroupId'],
      androidBasePlanId: json['androidBasePlanId'],
      trialEnabled: json['trialEnabled'] ?? false,
      trialDays: json['trialDays'] ?? 7,
    );
  }
}
