import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/auth/domain/auth_provider.dart';
import '../constants/api_constants.dart';
import 'auth_interceptor.dart';
import 'logging_interceptor.dart';
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
  // LoggingInterceptor를 먼저 등록 — 요청 발생/응답 도착 시점을
  // 그대로 기록. AuthInterceptor가 token refresh로 재시도하는 경우는
  // 새 RequestOptions로 다시 onRequest를 거치므로 자연스럽게 두 번
  // 로깅됨(원본 401 + 재시도). release에선 통째로 no-op.
  dio.interceptors.add(LoggingInterceptor());
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
