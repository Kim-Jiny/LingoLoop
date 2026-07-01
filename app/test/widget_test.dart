import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lingoloop/core/analytics/analytics_service.dart';
import 'package:lingoloop/core/network/api_client.dart';
import 'package:lingoloop/main.dart';

/// Returns an empty JSON body for every request without touching the
/// network. Without this the app's startup FutureProviders (today /
/// subscription / vocabulary) create real Dio connect-timeout timers
/// during the brief window the shell mounts, and the test fails with
/// "A Timer is still pending". The stub completes immediately so no
/// timer outlives the test.
class _StubAdapter implements HttpClientAdapter {
  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return ResponseBody.fromString(
      '{}',
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}

void main() {
  testWidgets('App renders', (WidgetTester tester) async {
    final stubDio = Dio()..httpClientAdapter = _StubAdapter();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          analyticsObserverProvider.overrideWithValue(null),
          dioProvider.overrideWithValue(stubDio),
        ],
        child: const LingoLoopApp(),
      ),
    );
    // Startup FutureProviders (subscription/today/vocabulary) fire Dio
    // calls that schedule zero-duration timers. The stub answers them
    // instantly, but we must advance time so those timers fire and
    // complete — otherwise the test tears down with pending timers.
    // Bounded pumps (not pumpAndSettle) so a loading spinner's infinite
    // animation can't hang the test.
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }

    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
