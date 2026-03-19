import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

final notificationRepositoryProvider =
    Provider<NotificationRepository>((ref) {
  return NotificationRepository(ref.read(dioProvider));
});

class NotificationRepository {
  final Dio _dio;

  NotificationRepository(this._dio);

  Future<void> registerToken(String token, String platform) async {
    await _dio.post('/api/notifications/token', data: {
      'token': token,
      'platform': platform,
    });
  }

  Future<void> removeToken(String token) async {
    await _dio.delete('/api/notifications/token/$token');
  }

  Future<NotificationSettingsModel> getSettings() async {
    final response = await _dio.get('/api/notifications/settings');
    return NotificationSettingsModel.fromJson(response.data);
  }

  Future<void> markPushTapped(String pushLogId) async {
    await _dio.post('/api/notifications/logs/$pushLogId/tap');
  }

  Future<NotificationSettingsModel> updateSettings({
    bool? isEnabled,
    int? frequencyMinutes,
    String? activeStartTime,
    String? activeEndTime,
    String? timezone,
    double? quizPushRatio,
  }) async {
    final response = await _dio.put('/api/notifications/settings', data: {
      if (isEnabled != null) 'isEnabled': isEnabled,
      if (frequencyMinutes != null) 'frequencyMinutes': frequencyMinutes,
      if (activeStartTime != null) 'activeStartTime': activeStartTime,
      if (activeEndTime != null) 'activeEndTime': activeEndTime,
      if (timezone != null) 'timezone': timezone,
      if (quizPushRatio != null) 'quizPushRatio': quizPushRatio,
    });
    return NotificationSettingsModel.fromJson(response.data);
  }
}

class NotificationSettingsModel {
  final bool isEnabled;
  final int frequencyMinutes;
  final String activeStartTime;
  final String activeEndTime;
  final String timezone;
  final double quizPushRatio;
  final String? nextPushAt;

  NotificationSettingsModel({
    required this.isEnabled,
    required this.frequencyMinutes,
    required this.activeStartTime,
    required this.activeEndTime,
    required this.timezone,
    required this.quizPushRatio,
    this.nextPushAt,
  });

  factory NotificationSettingsModel.fromJson(Map<String, dynamic> json) {
    return NotificationSettingsModel(
      isEnabled: json['isEnabled'] ?? true,
      frequencyMinutes: json['frequencyMinutes'] ?? 60,
      activeStartTime:
          (json['activeStartTime'] as String?)?.substring(0, 5) ?? '09:00',
      activeEndTime:
          (json['activeEndTime'] as String?)?.substring(0, 5) ?? '22:00',
      timezone: json['timezone'] ?? 'Asia/Seoul',
      quizPushRatio: (json['quizPushRatio'] as num?)?.toDouble() ?? 0.3,
      nextPushAt: json['nextPushAt'],
    );
  }
}
