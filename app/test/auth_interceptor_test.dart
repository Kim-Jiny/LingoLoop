// AuthInterceptor의 토큰 갱신 흐름 테스트.
//
// 여기서 지키려는 두 가지:
//
//  1. **일시적 장애로 로그아웃시키지 않는다.** 타임아웃·연결 끊김·5xx를
//     "refresh token 무효"와 같이 취급해 토큰을 지우면, 지하철에서 잠깐
//     끊긴 사용자가 이유도 모른 채 재로그인을 강요당한다. 복구 수단이
//     없는 종류의 실수라 명시적으로 못박는다.
//
//  2. **재시도는 한 번뿐이다.** dio의 `fetch`는 인터셉터 체인을 처음부터
//     다시 타므로, 재시도가 또 401일 때 아무 표식도 남기지 않으면 그
//     요청의 onError가 refresh + 재시도를 또 하고… 무한히 반복된다.
//     아래 '무한 재귀' 테스트가 refresh 호출 횟수를 직접 센다.

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lingoloop/core/constants/api_constants.dart';
import 'package:lingoloop/core/network/auth_interceptor.dart';
import 'package:lingoloop/core/network/token_storage.dart';
import 'package:mocktail/mocktail.dart';

class MockTokenStorage extends Mock implements TokenStorage {}

/// 응답 하나. [error]가 있으면 그걸 던지고, 없으면 [status]/[body]로
/// 응답한다.
class _Reply {
  final int status;
  final Object body;
  final DioException Function(RequestOptions)? error;

  const _Reply(this.status, [this.body = const <String, dynamic>{}])
    : error = null;
  const _Reply.throws(this.error) : status = 0, body = const <String, dynamic>{};
}

/// path별 응답 큐를 들고 있는 가짜 어댑터. 같은 path로 여러 번 오면
/// 큐에서 순서대로 꺼내 쓰고, 큐가 마르면 마지막 응답을 계속 돌려준다
/// (무한 재귀 테스트에서 "몇 번이든 401" 을 표현하기 위함).
class _FakeAdapter implements HttpClientAdapter {
  final Map<String, List<_Reply>> _queues;

  /// 실제로 도착한 요청 기록. 호출 횟수 검증에 쓴다.
  final List<RequestOptions> requests = <RequestOptions>[];

  /// 재귀 방지 안전판. 이걸 넘으면 무한 루프로 보고 즉시 터뜨린다 —
  /// 없으면 재귀 회귀가 "테스트 타임아웃"으로만 나타나 원인을 알기 어렵다.
  static const int _maxRequests = 10;

  _FakeAdapter(this._queues);

  int callsTo(String path) =>
      requests.where((r) => r.path == path).length;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    if (requests.length > _maxRequests) {
      throw StateError(
        '요청이 $_maxRequests회를 넘었다 — 토큰 갱신 재시도가 무한 재귀에 빠졌다.',
      );
    }
    final queue = _queues[options.path];
    if (queue == null || queue.isEmpty) {
      throw StateError('준비되지 않은 요청: ${options.path}');
    }
    // 마지막 하나는 남겨둬서 반복 호출에도 같은 응답이 나오게.
    final reply = queue.length > 1 ? queue.removeAt(0) : queue.first;
    final thrower = reply.error;
    if (thrower != null) throw thrower(options);
    return ResponseBody.fromString(
      jsonEncode(reply.body),
      reply.status,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>[Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

const String _protectedPath = '/api/sentences/today';

void main() {
  late MockTokenStorage storage;
  late int sessionExpiredCalls;
  // 실제 secure storage처럼 상태를 갖는 페이크. 고정값을 돌려주면
  // onRequest가 갱신된 토큰을 다시 읽어 붙이는 동작을 검증할 수 없다.
  String? storedAccess;
  String? storedRefresh;

  setUp(() {
    storage = MockTokenStorage();
    sessionExpiredCalls = 0;
    storedAccess = 'old-access';
    storedRefresh = 'refresh-1';
    when(() => storage.getAccessToken()).thenAnswer((_) async => storedAccess);
    when(() => storage.getRefreshToken()).thenAnswer((_) async => storedRefresh);
    when(() => storage.clearAll()).thenAnswer((_) async {
      storedAccess = null;
      storedRefresh = null;
    });
    when(
      () => storage.saveTokens(
        accessToken: any(named: 'accessToken'),
        refreshToken: any(named: 'refreshToken'),
      ),
    ).thenAnswer((invocation) async {
      storedAccess = invocation.namedArguments[#accessToken] as String;
      storedRefresh = invocation.namedArguments[#refreshToken] as String;
    });
  });

  /// 준비된 응답 큐로 Dio + AuthInterceptor를 조립한다.
  (Dio, _FakeAdapter) buildDio(Map<String, List<_Reply>> queues) {
    final dio = Dio(BaseOptions(baseUrl: 'https://test.local'));
    final adapter = _FakeAdapter(queues);
    dio.httpClientAdapter = adapter;
    dio.interceptors.add(
      AuthInterceptor(
        dio,
        storage,
        onSessionExpired: () => sessionExpiredCalls++,
      ),
    );
    return (dio, adapter);
  }

  group('일시적 장애', () {
    test('refresh가 타임아웃이면 토큰을 지우지 않는다', () async {
      final (dio, _) = buildDio({
        _protectedPath: [const _Reply(401)],
        ApiConstants.authRefresh: [
          _Reply.throws(
            (o) => DioException.connectionTimeout(
              timeout: const Duration(seconds: 10),
              requestOptions: o,
            ),
          ),
        ],
      });

      await expectLater(
        dio.get<dynamic>(_protectedPath),
        throwsA(
          isA<DioException>().having(
            (e) => e.response?.statusCode,
            'statusCode',
            401,
          ),
        ),
      );

      verifyNever(() => storage.clearAll());
      expect(sessionExpiredCalls, 0, reason: '로그아웃시키면 안 됨');
    });

    test('refresh가 5xx여도 토큰을 지우지 않는다', () async {
      final (dio, _) = buildDio({
        _protectedPath: [const _Reply(401)],
        ApiConstants.authRefresh: [const _Reply(503)],
      });

      await expectLater(dio.get<dynamic>(_protectedPath), throwsA(isA<DioException>()));

      verifyNever(() => storage.clearAll());
      expect(sessionExpiredCalls, 0);
    });

    test('refresh가 429면 토큰을 지우지 않는다', () async {
      final (dio, _) = buildDio({
        _protectedPath: [const _Reply(401)],
        ApiConstants.authRefresh: [const _Reply(429)],
      });

      await expectLater(dio.get<dynamic>(_protectedPath), throwsA(isA<DioException>()));

      verifyNever(() => storage.clearAll());
      expect(sessionExpiredCalls, 0);
    });

    test('갱신 성공 후 재시도가 500이어도 토큰을 지우지 않는다', () async {
      // 원래 버그: 재시도 한 번 실패했다고 세션을 통째로 날렸다.
      final (dio, _) = buildDio({
        _protectedPath: [const _Reply(401), const _Reply(500)],
        ApiConstants.authRefresh: [
          const _Reply(200, {'accessToken': 'new', 'refreshToken': 'r2'}),
        ],
      });

      await expectLater(dio.get<dynamic>(_protectedPath), throwsA(isA<DioException>()));

      verifyNever(() => storage.clearAll());
      expect(sessionExpiredCalls, 0);
    });
  });

  group('진짜 세션 만료', () {
    test('refresh가 401이면 토큰을 지우고 세션 만료를 알린다', () async {
      final (dio, _) = buildDio({
        _protectedPath: [const _Reply(401)],
        ApiConstants.authRefresh: [const _Reply(401)],
      });

      await expectLater(dio.get<dynamic>(_protectedPath), throwsA(isA<DioException>()));

      verify(() => storage.clearAll()).called(1);
      expect(sessionExpiredCalls, 1);
    });

    test('저장된 refresh token이 없으면 즉시 세션 만료', () async {
      when(() => storage.getRefreshToken()).thenAnswer((_) async => null);
      final (dio, adapter) = buildDio({
        _protectedPath: [const _Reply(401)],
        ApiConstants.authRefresh: [const _Reply(200)],
      });

      await expectLater(dio.get<dynamic>(_protectedPath), throwsA(isA<DioException>()));

      expect(sessionExpiredCalls, 1);
      expect(
        adapter.callsTo(ApiConstants.authRefresh),
        0,
        reason: '보낼 토큰이 없으면 요청 자체를 하지 않아야 함',
      );
    });
  });

  group('갱신 성공', () {
    test('새 토큰으로 원래 요청을 재시도하고 결과를 돌려준다', () async {
      final (dio, adapter) = buildDio({
        _protectedPath: [const _Reply(401), const _Reply(200, {'ok': true})],
        ApiConstants.authRefresh: [
          const _Reply(200, {'accessToken': 'new', 'refreshToken': 'r2'}),
        ],
      });

      final res = await dio.get<dynamic>(_protectedPath);

      expect(res.data['ok'], isTrue);
      verify(
        () => storage.saveTokens(accessToken: 'new', refreshToken: 'r2'),
      ).called(1);
      // 재시도 요청은 새 access token을 달고 나가야 한다. 실제로 이
      // 헤더를 채우는 건 onRequest이고(갱신된 토큰을 저장소에서 다시
      // 읽는다), 그래서 페이크 저장소가 상태를 가져야만 의미가 있다.
      final retry = adapter.requests.last;
      expect(retry.headers['Authorization'], 'Bearer new');
      expect(sessionExpiredCalls, 0);
    });
  });

  group('무한 재귀 방지', () {
    test('재시도가 또 401이어도 refresh는 한 번만 일어난다', () async {
      // dio.fetch가 인터셉터 체인을 다시 타기 때문에, 표식이 없으면
      // 재시도 → 401 → refresh → 재시도 → 401 → … 로 끝없이 돈다.
      // 큐의 마지막 응답은 계속 재사용되므로 서버는 "몇 번이든 401".
      final (dio, adapter) = buildDio({
        _protectedPath: [const _Reply(401)],
        ApiConstants.authRefresh: [
          const _Reply(200, {'accessToken': 'new', 'refreshToken': 'r2'}),
        ],
      });

      await expectLater(dio.get<dynamic>(_protectedPath), throwsA(isA<DioException>()));

      expect(
        adapter.callsTo(ApiConstants.authRefresh),
        1,
        reason: '재귀했다면 refresh가 여러 번 호출된다',
      );
      expect(
        adapter.callsTo(_protectedPath),
        2,
        reason: '원본 1회 + 재시도 1회로 끝나야 한다',
      );
      // 새 토큰으로도 401이면 진짜 만료로 처리.
      verify(() => storage.clearAll()).called(1);
      expect(sessionExpiredCalls, 1);
    });
  });

  group('요청 헤더', () {
    test('refresh 엔드포인트에는 Authorization을 붙이지 않는다', () async {
      final (dio, adapter) = buildDio({
        ApiConstants.authRefresh: [const _Reply(200)],
      });

      await dio.post<dynamic>(ApiConstants.authRefresh);

      expect(adapter.requests.single.headers.containsKey('Authorization'), isFalse);
    });

    test('보호된 경로에는 저장된 access token을 붙인다', () async {
      final (dio, adapter) = buildDio({
        _protectedPath: [const _Reply(200)],
      });

      await dio.get<dynamic>(_protectedPath);

      expect(adapter.requests.single.headers['Authorization'], 'Bearer old-access');
    });
  });
}
