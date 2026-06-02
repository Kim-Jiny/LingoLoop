import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/client_info.dart';
import '../../../core/network/token_storage.dart';
import '../domain/auth_model.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.read(dioProvider), ref.read(tokenStorageProvider));
});

class AuthRepository {
  final Dio _dio;
  final TokenStorage _tokenStorage;

  AuthRepository(this._dio, this._tokenStorage);

  Future<String?> _deviceTz() async {
    try {
      return await FlutterTimezone.getLocalTimezone();
    } catch (_) {
      return null;
    }
  }

  Future<AuthResponse> register({
    required String email,
    required String password,
    String? nickname,
  }) async {
    final tz = await _deviceTz();
    final clientInfo = await ClientInfo.resolve();
    final response = await _dio.post(
      ApiConstants.authRegister,
      data: {
        'email': email,
        'password': password,
        'nickname': ?nickname,
        'timezone': ?tz,
        'clientInfo': clientInfo,
      },
    );
    final authResponse = AuthResponse.fromJson(response.data);
    await _saveAuth(authResponse);
    return authResponse;
  }

  Future<AuthResponse> login({
    required String email,
    required String password,
  }) async {
    final tz = await _deviceTz();
    final clientInfo = await ClientInfo.resolve();
    final response = await _dio.post(
      ApiConstants.authLogin,
      data: {
        'email': email,
        'password': password,
        'timezone': ?tz,
        'clientInfo': clientInfo,
      },
    );
    final authResponse = AuthResponse.fromJson(response.data);
    await _saveAuth(authResponse);
    return authResponse;
  }

  Future<AuthResponse> socialLogin({
    required String provider,
    required String token,
    String? nickname,
    String? authorizationCode,
  }) async {
    final tz = await _deviceTz();
    final clientInfo = await ClientInfo.resolve();
    final response = await _dio.post(
      ApiConstants.authSocial,
      data: {
        'provider': provider,
        'token': token,
        'nickname': ?nickname,
        'timezone': ?tz,
        'authorizationCode': ?authorizationCode,
        'clientInfo': clientInfo,
      },
    );
    final authResponse = AuthResponse.fromJson(response.data);
    await _saveAuth(authResponse);
    return authResponse;
  }

  Future<void> linkSocial({
    required String provider,
    required String token,
  }) async {
    await _dio.post(
      ApiConstants.authSocialLink,
      data: {'provider': provider, 'token': token},
    );
  }

  Future<IdentitiesInfo> listIdentities() async {
    final response = await _dio.get(ApiConstants.authIdentities);
    return IdentitiesInfo.fromJson(response.data);
  }

  /// 다언어 — 사용자가 각 학습 언어에 대해 저장한 트랙. 설정/언어 전환
  /// UX에서 활용. row 없는 언어는 응답에서 제외돼 length로 "한 번이라도
  /// 트랙 선택한 적 있는지" 판단 가능.
  Future<List<({String languageCode, String track})>>
      listLanguageTracks() async {
    final response = await _dio.get(ApiConstants.authLanguageTracks);
    final list = (response.data['tracks'] as List? ?? []);
    return list
        .map(
          (e) => (
            languageCode: e['languageCode'] as String,
            track: e['track'] as String,
          ),
        )
        .toList();
  }

  Future<void> unlinkSocial(String provider) async {
    await _dio.delete('${ApiConstants.authIdentities}/$provider');
  }

  Future<void> logout() async {
    await _tokenStorage.clearAll();
  }

  /// 콜드 스타트용 — 캐시된 user를 즉시 반환해 router가 로그인 화면을
  /// 깜빡이지 않게 함. 네트워크 호출은 [refreshCachedUser]에서 백그라운드로.
  /// 토큰이 없으면 null (진짜 로그아웃 상태).
  Future<UserInfo?> getCurrentUser() async {
    final hasTokens = await _tokenStorage.hasTokens();
    if (!hasTokens) return null;

    final cachedJson = await _tokenStorage.getCachedUser();
    if (cachedJson != null) {
      try {
        return UserInfo.fromJson(jsonDecode(cachedJson));
      } catch (_) {/* 손상된 캐시는 무시하고 fall through */}
    }

    // 캐시 미존재(구버전에서 업그레이드 또는 첫 부팅) — 네트워크 시도.
    // 401은 interceptor의 refresh 흐름이 처리하므로 여기까지 오면 진짜
    // 인증 실패이거나 네트워크 오류. 네트워크 오류면 일단 null이지만
    // 토큰은 살아있어 다음 진입에서 재시도됨.
    try {
      final response = await _dio.get(ApiConstants.authMe);
      final user = UserInfo.fromJson(response.data);
      await _tokenStorage.saveCachedUser(jsonEncode(user.toJson()));
      return user;
    } catch (e) {
      // 네트워크 오류(timeout/connectionError)는 세션을 죽이지 않음 —
      // 토큰이 있는 한 다음 부팅/네트워크 회복 시 다시 시도.
      if (e is DioException &&
          e.type != DioExceptionType.badResponse &&
          e.response == null) {
        return null;
      }
      return null;
    }
  }

  /// 캐시된 user로 부팅한 직후, 서버 최신 상태를 가져와 캐시를 갱신.
  /// 401은 interceptor가 알아서 처리 — 여기서 throw는 swallow.
  Future<UserInfo?> refreshCurrentUserFromServer() async {
    try {
      final response = await _dio.get(ApiConstants.authMe);
      final user = UserInfo.fromJson(response.data);
      await _tokenStorage.saveCachedUser(jsonEncode(user.toJson()));
      return user;
    } catch (_) {
      return null;
    }
  }

  Future<UserInfo> updateProfile({
    String? nickname,
    String? targetLanguage,
    String? nativeLanguage,
    String? learningTrack,
    int? dailyGoal,
  }) async {
    final response = await _dio.patch(
      ApiConstants.authUpdateMe,
      // Only send provided fields — sending null would wipe NOT NULL
      // columns (targetLanguage) or erase the nickname.
      data: {
        'nickname': ?nickname,
        'targetLanguage': ?targetLanguage,
        'nativeLanguage': ?nativeLanguage,
        'learningTrack': ?learningTrack,
        'dailyGoal': ?dailyGoal,
      },
    );
    final user = UserInfo.fromJson(response.data);
    await _tokenStorage.saveCachedUser(jsonEncode(user.toJson()));
    return user;
  }

  /// Permanently deletes the calling user and every server-side row tied
  /// to them. Server cascades child tables; local token storage is
  /// cleared by the AuthState wrapper that calls this.
  ///
  /// When [force] is true, bypasses the server's active-subscription
  /// guard. The guard is intentional: deleting an account while a paid
  /// store subscription is still active leaves the user being billed
  /// without anywhere to use the service. The UI should show a
  /// confirmation dialog before passing `force=true`.
  Future<void> deleteAccount({bool force = false}) async {
    await _dio.delete(
      ApiConstants.authUpdateMe,
      queryParameters: force ? {'force': '1'} : null,
    );
  }

  Future<void> _saveAuth(AuthResponse auth) async {
    await _tokenStorage.saveTokens(
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
    );
    await _tokenStorage.saveUserId(auth.user.id);
    await _tokenStorage.saveCachedUser(jsonEncode(auth.user.toJson()));
  }
}
