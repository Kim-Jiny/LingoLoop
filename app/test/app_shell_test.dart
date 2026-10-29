import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lingoloop/core/widgets/app_shell.dart';
import 'package:lingoloop/features/subscription/data/subscription_repository.dart';
import 'package:lingoloop/features/subscription/domain/subscription_provider.dart';

Future<void> _pump(WidgetTester tester, {String location = '/'}) async {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        subscriptionStatusProvider.overrideWith(
          (ref) async => SubscriptionStatus.fromJson({}),
        ),
      ],
      child: MaterialApp(
        home: AppShell(
          location: location,
          child: ListView(
            children: [
              for (var i = 0; i < 60; i++) ListTile(title: Text('row $i')),
            ],
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

double _barTop(WidgetTester tester) =>
    tester.getTopLeft(find.byType(NavigationBar)).dy;

void main() {
  testWidgets('탭바 높이가 줄었고 예외 없이 그려진다', (tester) async {
    await _pump(tester);
    expect(tester.takeException(), isNull);
    expect(tester.getSize(find.byType(NavigationBar)).height, 60);
    expect(find.text('오늘'), findsOneWidget);
  });

  testWidgets('아래로 스크롤하면 숨고 위로 스크롤하면 다시 나온다', (tester) async {
    await _pump(tester);
    final shownTop = _barTop(tester);

    // 아래로 스크롤(손가락을 위로) → 숨김
    await tester.fling(find.byType(ListView), const Offset(0, -300), 1000);
    await tester.pumpAndSettle();
    expect(_barTop(tester), greaterThan(shownTop + 50));
    expect(
      tester.widget<IgnorePointer>(
        find.ancestor(
          of: find.byType(NavigationBar),
          matching: find.byType(IgnorePointer),
        ).first,
      ).ignoring,
      isTrue,
    );

    // 위로 스크롤(손가락을 아래로) → 다시 보임
    await tester.fling(find.byType(ListView), const Offset(0, 300), 1000);
    await tester.pumpAndSettle();
    expect(_barTop(tester), shownTop);
  });
}
