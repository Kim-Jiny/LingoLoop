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
  Future<_RefreshResult>? _refreshFuture;

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
    // Skip auth header for public endpoints. EXACT match on the path —
    // a `.contains()` check would treat `/api/auth/social/link` (auth
    // required) as public because it contains `/api/auth/social`, and
    // `/api/auth/me/language-tracks` as public via `/api/auth/me`,
    // dropping the Authorization header → 401 on authenticated calls.
    const publicPaths = {
      ApiConstants.authLogin,
      ApiConstants.authRegister,
      ApiConstants.authRefresh,
      ApiConstants.authSocial,
      ApiConstants.adminSeed,
    };
    if (publicPaths.contains(options.uri.path)) {
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
        final result = await refresh;
        if (identical(_refreshFuture, refresh)) {
          _refreshFuture = null;
        }
        if (result.accessToken == null) {
          if (!result.transient) {
            // 서버가 refresh token을 명시적으로 거부 → 진짜 세션 만료.
            // authStateProvider를 flip시켜 router가 /login으로 redirect.
            // 안 그러면 사용자는 로그인 화면 그대로 보면서 모든 API가
            // 401 → 빈 화면 + 토스트만 반복.
            _onSessionExpired?.call();
          }
          // 일시적 장애(오프라인·타임아웃·5xx)면 토큰을 보존한 채 원본
          // 401만 올려보낸다. 다음 요청이 refresh를 다시 시도한다.
          return handler.next(err);
        }

        // Retry original request
        final opts = err.requestOptions;
        opts.headers['Authorization'] = 'Bearer ${result.accessToken}';
        final retryResponse = await _dio.fetch(opts);
        return handler.resolve(retryResponse);
      } catch (e) {
        // 여기 도달하는 건 재시도 요청(_dio.fetch)의 실패뿐이다 —
        // _refreshTokens는 내부에서 모두 처리하고 throw하지 않는다.
        // 이 시점엔 refresh가 이미 성공했으므로 토큰을 지우면 안 된다.
        // 재시도가 500/타임아웃 한 번 났다고 로그아웃시키던 게 버그였다.
        // 새 access token으로도 401이면 그건 진짜 만료.
        // _refreshFuture는 위에서 이미 비웠지만, 예상 못 한 경로로
        // 여기 왔을 때 실패한 future가 고착되지 않도록 한 번 더 비운다.
        _refreshFuture = null;
        if (e is DioException && e.response?.statusCode == 401) {
          await _tokenStorage.clearAll();
          _onSessionExpired?.call();
        }
        return handler.next(err);
      }
    }
    handler.next(err);
  }

  /// 절대 throw하지 않는다. 실패는 전부 [_RefreshResult]로 표현한다 —
  /// 여기서 예외가 새어나가면 `_refreshFuture`에 실패한 future가 그대로
  /// 남아 이후 모든 401이 같은 예외를 다시 받고 refresh를 영영 재시도
  /// 못 하게 된다. secure storage 접근 실패도 마찬가지라 try 안에 둔다.
  Future<_RefreshResult> _refreshTokens() async {
    try {
      final refreshToken = await _tokenStorage.getRefreshToken();
      // 저장된 토큰 자체가 없음 = 세션 없음. 일시적 상황이 아니다.
      if (refreshToken == null) return const _RefreshResult.expired();

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
      return _RefreshResult.success(newAccessToken);
    } catch (e) {
      if (_isTokenRejected(e)) {
        await _tokenStorage.clearAll();
        return const _RefreshResult.expired();
      }
      // 네트워크/서버 장애 — 토큰을 지우지 않는다. 지하철에서 잠깐
      // 끊긴 것만으로 재로그인을 강요하던 게 원래 동작이었다.
      return const _RefreshResult.transient();
    }
  }

  /// 서버가 "이 refresh token은 더 이상 유효하지 않다"고 **명시적으로**
  /// 답한 경우에만 true. 타임아웃·연결 끊김·5xx·인증서 오류·응답 파싱
  /// 실패는 전부 회선/서버 문제이지 토큰 문제가 아니므로 false다.
  /// 판단이 애매하면 false(=토큰 보존) 쪽으로 기운다 — 잘못 유지하면
  /// 다음 요청에서 다시 만료 처리되지만, 잘못 지우면 복구 불가능하다.
  static bool _isTokenRejected(Object e) {
    if (e is! DioException) return false;
    if (e.type != DioExceptionType.badResponse) return false;
    final status = e.response?.statusCode ?? 0;
    // 408 Request Timeout / 429 Too Many Requests는 4xx지만 재시도 대상.
    if (status == 408 || status == 429) return false;
    return status >= 400 && status < 500;
  }
}

/// refresh 시도 결과. "토큰이 무효함"과 "지금 통신이 안 됨"을 구분하기
/// 위한 타입. 이 구분이 없으면 일시적 네트워크 오류가 영구 로그아웃이
/// 된다.
class _RefreshResult {
  /// 갱신에 성공했을 때의 새 access token. 실패 시 null.
  final String? accessToken;

  /// true면 회복 가능한 실패 — 토큰을 보존하고 세션 만료 처리도 하지
  /// 않는다.
  final bool transient;

  const _RefreshResult.success(this.accessToken) : transient = false;
  const _RefreshResult.expired() : accessToken = null, transient = false;
  const _RefreshResult.transient() : accessToken = null, transient = true;
}
