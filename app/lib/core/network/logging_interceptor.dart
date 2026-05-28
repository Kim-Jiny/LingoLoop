import 'dart:developer' as developer;
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// API 통신 디버그 로깅. release 빌드에선 통째로 no-op.
///
/// 한 요청당 한 줄로 출력 — `dart:developer.log`를 쓰면 Xcode/AS
/// Logcat 둘 다에서 깔끔하게 잡힘. body는 미리보기 200자만 (긴 응답
/// 본문은 PII 노출 + 로그 막힘 위험).
///
/// 헬스/asset 등 노이즈 path는 skip. 같은 요청에 대한 request →
/// response/error를 추적할 수 있도록 stopwatch로 elapsed 표시.
class LoggingInterceptor extends Interceptor {
  static const _maxBodyChars = 200;
  // RequestOptions.extra에 stopwatch를 박아 response/error에서 회수.
  static const _kStopwatchKey = '_loggingStopwatch';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (!kDebugMode) {
      handler.next(options);
      return;
    }
    options.extra[_kStopwatchKey] = Stopwatch()..start();
    developer.log(
      '→ ${options.method} ${_pathPreview(options)}',
      name: 'API',
    );
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    if (!kDebugMode) {
      handler.next(response);
      return;
    }
    final ms = _elapsedMs(response.requestOptions);
    developer.log(
      '← ${response.statusCode} ${response.requestOptions.method} '
      '${_pathPreview(response.requestOptions)} ${ms}ms',
      name: 'API',
    );
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (!kDebugMode) {
      handler.next(err);
      return;
    }
    final ms = _elapsedMs(err.requestOptions);
    final status = err.response?.statusCode;
    final bodyPreview = _bodyPreview(err.response?.data);
    developer.log(
      '✘ ${status ?? err.type.name} ${err.requestOptions.method} '
      '${_pathPreview(err.requestOptions)} ${ms}ms'
      '${bodyPreview.isNotEmpty ? ' :: $bodyPreview' : ''}',
      name: 'API',
      error: err.message,
    );
    handler.next(err);
  }

  String _pathPreview(RequestOptions options) {
    // path가 절대 URL이면 origin을 잘라 path만 — 로그 가독성.
    final raw = options.uri.toString();
    final base = options.baseUrl;
    if (base.isNotEmpty && raw.startsWith(base)) {
      return raw.substring(base.length);
    }
    return options.path;
  }

  int _elapsedMs(RequestOptions options) {
    final sw = options.extra[_kStopwatchKey];
    if (sw is Stopwatch) {
      sw.stop();
      return sw.elapsedMilliseconds;
    }
    return 0;
  }

  String _bodyPreview(dynamic data) {
    if (data == null) return '';
    final text = data.toString();
    if (text.length <= _maxBodyChars) return text;
    return '${text.substring(0, _maxBodyChars)}…';
  }
}
