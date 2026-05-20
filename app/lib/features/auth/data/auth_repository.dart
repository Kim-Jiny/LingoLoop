import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
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
    final response = await _dio.post(
      ApiConstants.authRegister,
      data: {
        'email': email,
        'password': password,
        'nickname': ?nickname,
        'timezone': ?tz,
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
    final response = await _dio.post(
      ApiConstants.authLogin,
      data: {'email': email, 'password': password, 'timezone': ?tz},
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
    final response = await _dio.post(
      ApiConstants.authSocial,
      data: {
        'provider': provider,
        'token': token,
        'nickname': ?nickname,
        'timezone': ?tz,
        'authorizationCode': ?authorizationCode,
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

  Future<void> unlinkSocial(String provider) async {
    await _dio.delete('${ApiConstants.authIdentities}/$provider');
  }

  Future<void> logout() async {
    await _tokenStorage.clearAll();
  }

  Future<UserInfo?> getCurrentUser() async {
    final hasTokens = await _tokenStorage.hasTokens();
    if (!hasTokens) return null;
    try {
      final response = await _dio.get(ApiConstants.authMe);
      return UserInfo.fromJson(response.data);
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
    return UserInfo.fromJson(response.data);
  }

  /// Permanently deletes the calling user and every server-side row tied
  /// to them. Server cascades child tables; local token storage is
  /// cleared by the AuthState wrapper that calls this.
  Future<void> deleteAccount() async {
    await _dio.delete(ApiConstants.authUpdateMe);
  }

  Future<void> _saveAuth(AuthResponse auth) async {
    await _tokenStorage.saveTokens(
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
    );
    await _tokenStorage.saveUserId(auth.user.id);
  }
}
