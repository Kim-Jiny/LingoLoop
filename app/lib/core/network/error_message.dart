import 'package:dio/dio.dart';
import 'package:flutter/services.dart';

/// Maps raw exceptions (mostly [DioException]) to a short, user-friendly
/// Korean message so screens never surface stack-trace-like text.
///
/// Precedence rule:
///   1. Network-level failures first — timeout / no connection / etc.
///   2. Status-code mapping for canonical auth + business cases
///      (401 = wrong credentials, 5xx = server down, …). This OVERRIDES
///      the server's body message — NestJS defaults to English strings
///      like "Invalid credentials" which we don't want surfaced.
///   3. Fall back to the server's body message ONLY when it is plainly
///      in Korean (Hangul detection). Most of our intentional 409 /
///      403 messages are localized; anything else (English validator
///      output, default Nest text) gets the [fallback] copy from the
///      caller instead.
String friendlyErrorMessage(
  Object? error, {
  String fallback = '문제가 발생했어요. 잠시 후 다시 시도해주세요.',
}) {
  if (error is DioException) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return '네트워크 연결이 느려요. 잠시 후 다시 시도해주세요.';
      case DioExceptionType.connectionError:
        return '서버에 연결할 수 없어요. 인터넷 연결을 확인해주세요.';
      case DioExceptionType.cancel:
        // User-triggered cancel; not really an error worth surfacing.
        return fallback;
      case DioExceptionType.badCertificate:
        return '보안 인증서에 문제가 있어요. 잠시 후 다시 시도해주세요.';
      case DioExceptionType.badResponse:
        return _mapBadResponse(error, fallback);
      case DioExceptionType.unknown:
        // SocketException (DNS / unreachable) usually lands here on
        // some Dio versions.
        return '서버에 연결할 수 없어요. 인터넷 연결을 확인해주세요.';
    }
  }
  if (error is PlatformException) {
    final code = error.code;
    final msg = (error.message ?? '').toLowerCase();
    if (code == '10' || msg.contains('developer_error')) {
      return '구글 로그인 설정 오류예요. (개발자 콘솔에 이 앱의 SHA-1·패키지'
          ' OAuth 클라이언트 등록과 OAuth 동의화면 설정을 확인해주세요)';
    }
    if (code == '7' || msg.contains('network')) {
      return '네트워크 문제로 로그인하지 못했어요. 연결을 확인해주세요.';
    }
    if (code == 'sign_in_failed') {
      return '소셜 로그인에 실패했어요. (code $code: ${error.message ?? ''})';
    }
    return '$fallback (${error.code}: ${error.message ?? ''})';
  }
  return fallback;
}

String _mapBadResponse(DioException error, String fallback) {
  final status = error.response?.statusCode ?? 0;
  final serverMessage = _extractServerMessage(error.response?.data);

  // Canonical mappings that override the server's English defaults.
  switch (status) {
    case 400:
      // Validation errors usually carry an array of strings. Prefer
      // server message when present (it tells the user *which* field),
      // otherwise generic.
      if (serverMessage != null) return serverMessage;
      return '입력하신 내용을 다시 확인해주세요.';

    case 401:
      // Login / register / refresh — always the credentials path.
      // The server returns "Invalid credentials" (English) which is
      // worse than our localized message.
      return '이메일 또는 비밀번호가 올바르지 않아요.';

    case 403:
      // Almost all 403s in this project carry a localized Korean
      // message (premium gating, deleted-user guard, …). Surface it
      // when present.
      if (serverMessage != null && _containsKorean(serverMessage)) {
        return serverMessage;
      }
      return '이 기능을 이용할 권한이 없어요.';

    case 404:
      if (serverMessage != null && _containsKorean(serverMessage)) {
        return serverMessage;
      }
      return '요청한 정보를 찾을 수 없어요.';

    case 409:
      // 409 cases in this project:
      //   - register: email already in use (English from Nest default)
      //   - subscription: family-shared id collision (Korean)
      //   - account delete: active subscription guard (Korean)
      // Korean → trust it. English → use a sensible generic.
      if (serverMessage != null && _containsKorean(serverMessage)) {
        return serverMessage;
      }
      return '이미 사용 중이거나 다른 계정에 연결되어 있어요.';

    case 429:
      return '잠시 후 다시 시도해주세요. 너무 자주 요청하셨어요.';
  }

  if (status >= 500) {
    return '서버에 일시적인 문제가 있어요. 잠시 후 다시 시도해주세요.';
  }

  // Unknown status — last-ditch: show server message if it's Korean,
  // otherwise the caller's fallback.
  if (serverMessage != null && _containsKorean(serverMessage)) {
    return serverMessage;
  }
  return fallback;
}

String? _extractServerMessage(dynamic data) {
  if (data is Map && data['message'] != null) {
    final msg = data['message'];
    if (msg is String && msg.isNotEmpty) return msg;
    if (msg is List && msg.isNotEmpty) return msg.first.toString();
  }
  return null;
}

bool _containsKorean(String s) {
  // Hangul syllables block; covers everything our localized server
  // messages emit.
  return RegExp(r'[가-힯]').hasMatch(s);
}
