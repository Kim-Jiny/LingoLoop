import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/auth/domain/auth_provider.dart';
import '../constants/api_constants.dart';
import 'auth_interceptor.dart';
import 'token_storage.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {'Content-Type': 'application/json'},
    ),
  );

  final tokenStorage = ref.read(tokenStorageProvider);
  dio.interceptors.add(
    AuthInterceptor(
      dio,
      tokenStorage,
      onSessionExpired: () {
        // refresh token까지 만료/취소된 경우. authStateProvider를
        // 무효화하면 build()가 재실행되며 토큰 없는 상태에서
        // getCurrentUser() → null 반환 → state=AsyncData(null) →
        // router가 /login으로 redirect.
        ref.invalidate(authStateProvider);
      },
    ),
  );

  return dio;
});
