import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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

  Future<AuthResponse> register({
    required String email,
    required String password,
    String? nickname,
  }) async {
    final response = await _dio.post(ApiConstants.authRegister, data: {
      'email': email,
      'password': password,
      if (nickname != null) 'nickname': nickname,
    });
    final authResponse = AuthResponse.fromJson(response.data);
    await _saveAuth(authResponse);
    return authResponse;
  }

  Future<AuthResponse> login({
    required String email,
    required String password,
  }) async {
    final response = await _dio.post(ApiConstants.authLogin, data: {
      'email': email,
      'password': password,
    });
    final authResponse = AuthResponse.fromJson(response.data);
    await _saveAuth(authResponse);
    return authResponse;
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

  Future<void> _saveAuth(AuthResponse auth) async {
    await _tokenStorage.saveTokens(
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
    );
    await _tokenStorage.saveUserId(auth.user.id);
  }
}
