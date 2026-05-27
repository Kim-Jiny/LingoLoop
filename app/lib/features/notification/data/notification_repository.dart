import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';

final notificationRepositoryProvider = Provider<NotificationRepository>((ref) {
  return NotificationRepository(ref.read(dioProvider));
});

class NotificationRepository {
  final Dio _dio;

  NotificationRepository(this._dio);

  Future<void> registerToken(String token, String platform) async {
    await _dio.post(
      ApiConstants.notificationToken,
      data: {'token': token, 'platform': platform},
    );
  }

  Future<void> removeToken(String token) async {
    await _dio.delete('${ApiConstants.notificationToken}/$token');
  }

  Future<NotificationSettingsModel> getSettings() async {
    final response = await _dio.get(ApiConstants.notificationSettings);
    return NotificationSettingsModel.fromJson(response.data);
  }

  Future<void> markPushTapped(String pushLogId) async {
    await _dio.post('${ApiConstants.notificationLogs}/$pushLogId/tap');
  }

  Future<NotificationSettingsModel> updateSettings({
    bool? isEnabled,
    int? frequencyMinutes,
    String? activeStartTime,
    String? activeEndTime,
    String? timezone,
    double? quizPushRatio,
  }) async {
    final response = await _dio.put(
      ApiConstants.notificationSettings,
      data: {
        'isEnabled': ?isEnabled,
        'frequencyMinutes': ?frequencyMinutes,
        'activeStartTime': ?activeStartTime,
        'activeEndTime': ?activeEndTime,
        'timezone': ?timezone,
        'quizPushRatio': ?quizPushRatio,
      },
    );
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
      activeStartTime: _timeOfDay(json['activeStartTime'], '09:00'),
      activeEndTime: _timeOfDay(json['activeEndTime'], '22:00'),
      timezone: json['timezone'] ?? 'Asia/Seoul',
      quizPushRatio: (json['quizPushRatio'] as num?)?.toDouble() ?? 0.3,
      nextPushAt: json['nextPushAt'],
    );
  }
}

String _timeOfDay(dynamic value, String fallback) {
  final text = value?.toString();
  if (text == null || text.length < 5) return fallback;
  return text.substring(0, 5);
}
