import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final tokenStorageProvider = Provider<TokenStorage>((ref) {
  return TokenStorage();
});

class TokenStorage {
  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';
  static const _userIdKey = 'user_id';
  static const _cachedUserKey = 'cached_user';

  final _storage = const FlutterSecureStorage();

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await Future.wait([
      _storage.write(key: _accessTokenKey, value: accessToken),
      _storage.write(key: _refreshTokenKey, value: refreshToken),
    ]);
  }

  Future<String?> getAccessToken() => _storage.read(key: _accessTokenKey);
  Future<String?> getRefreshToken() => _storage.read(key: _refreshTokenKey);

  Future<void> saveUserId(String userId) =>
      _storage.write(key: _userIdKey, value: userId);
  Future<String?> getUserId() => _storage.read(key: _userIdKey);

  /// /auth/me 응답을 secure storage에 캐시. 다음 콜드 스타트에서 네트워크
  /// 응답을 기다리지 않고 즉시 로그인 상태로 부팅, /auth/me는 백그라운드
  /// 갱신용으로만 사용 → "로그인 화면 깜빡임" 해소.
  Future<void> saveCachedUser(String userJson) =>
      _storage.write(key: _cachedUserKey, value: userJson);
  Future<String?> getCachedUser() => _storage.read(key: _cachedUserKey);

  Future<void> clearAll() => _storage.deleteAll();

  Future<bool> hasTokens() async {
    final token = await getAccessToken();
    return token != null;
  }
}
