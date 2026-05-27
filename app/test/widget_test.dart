import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lingoloop/core/analytics/analytics_service.dart';
import 'package:lingoloop/main.dart';

void main() {
  testWidgets('App renders', (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [analyticsObserverProvider.overrideWithValue(null)],
        child: const LingoLoopApp(),
      ),
    );

    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
