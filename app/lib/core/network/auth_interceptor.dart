import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import 'client_info.dart';
import 'token_storage.dart';

class AuthInterceptor extends Interceptor {
  final Dio _dio;
  final TokenStorage _tokenStorage;
  /// refresh가 영구 실패(401/만료/취소)했을 때 호출 — 호출자가
  /// authStateProvider를 null로 flip시켜 router가 /login으로 보내게.
  /// callback 패턴으로 받는 이유는 인터셉터에서 Riverpod ref를 직접
  /// 잡기엔 dio 생성 순서/생명주기가 꼬여서. main에서 dioProvider
  /// 정의할 때 ref.invalidate 콜백을 주입.
  final void Function()? _onSessionExpired;
  Future<String?>? _refreshFuture;

  AuthInterceptor(
    this._dio,
    this._tokenStorage, {
    void Function()? onSessionExpired,
  }) : _onSessionExpired = onSessionExpired;

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Skip auth header for public endpoints
    final publicPaths = [
      ApiConstants.authLogin,
      ApiConstants.authRegister,
      ApiConstants.authRefresh,
      ApiConstants.adminSeed,
    ];
    if (publicPaths.any((p) => options.path.contains(p))) {
      return handler.next(options);
    }

    final token = await _tokenStorage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401 &&
        !err.requestOptions.path.contains(ApiConstants.authRefresh)) {
      try {
        final refresh = _refreshFuture ??= _refreshTokens();
        final newAccessToken = await refresh;
        if (identical(_refreshFuture, refresh)) {
          _refreshFuture = null;
        }
        if (newAccessToken == null) {
          // refresh가 영구 실패 → authStateProvider도 null로 flip
          // 시켜 router가 /login으로 redirect. 안 그러면 사용자는
          // 로그인 화면 그대로 보면서 모든 API가 401 → 빈 화면 +
          // 토스트만 반복.
          _onSessionExpired?.call();
          return handler.next(err);
        }

        // Retry original request
        final opts = err.requestOptions;
        opts.headers['Authorization'] = 'Bearer $newAccessToken';
        final retryResponse = await _dio.fetch(opts);
        return handler.resolve(retryResponse);
      } catch (e) {
        _refreshFuture = null;
        await _tokenStorage.clearAll();
        _onSessionExpired?.call();
        return handler.next(err);
      }
    }
    handler.next(err);
  }

  Future<String?> _refreshTokens() async {
    try {
      final refreshToken = await _tokenStorage.getRefreshToken();
      if (refreshToken == null) return null;

      // clientInfo는 첫 호출 이후 메모리 캐시 — 백그라운드 refresh가
      // 잦아도 device_info_plus 호출은 한 번만 발생함.
      final clientInfo = await ClientInfo.resolve();
      final response = await _dio.post(
        ApiConstants.authRefresh,
        data: {'refreshToken': refreshToken, 'clientInfo': clientInfo},
      );

      final newAccessToken = response.data['accessToken'] as String;
      final newRefreshToken = response.data['refreshToken'] as String;
      await _tokenStorage.saveTokens(
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      );
      return newAccessToken;
    } catch (_) {
      await _tokenStorage.clearAll();
      return null;
    }
  }
}
