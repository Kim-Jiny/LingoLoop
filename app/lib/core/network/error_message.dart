import 'package:dio/dio.dart';

/// Maps raw exceptions (mostly [DioException]) to a short, user-friendly
/// Korean message so screens never surface stack-trace-like text.
String friendlyErrorMessage(
  Object? error, {
  String fallback = '문제가 발생했어요. 잠시 후 다시 시도해주세요.',
}) {
  if (error is DioException) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return '네트워크가 느려요. 연결 상태를 확인해주세요.';
      case DioExceptionType.connectionError:
        return '서버에 연결할 수 없어요. 인터넷 연결을 확인해주세요.';
      case DioExceptionType.badResponse:
        final status = error.response?.statusCode ?? 0;
        final data = error.response?.data;
        if (data is Map && data['message'] != null) {
          final msg = data['message'];
          if (msg is String) return msg;
          if (msg is List && msg.isNotEmpty) return msg.first.toString();
        }
        if (status == 401) return '이메일 또는 비밀번호가 올바르지 않아요.';
        if (status == 409) return '이미 사용 중인 이메일이에요.';
        if (status >= 500) return '서버에 일시적인 문제가 있어요. 잠시 후 다시 시도해주세요.';
        return fallback;
      default:
        return fallback;
    }
  }
  return fallback;
}
