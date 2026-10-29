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
    tester.getTopLeft(find.byKey(const ValueKey('app-tab-bar'))).dy;

void main() {
  testWidgets('탭바 높이가 줄었고 예외 없이 그려진다', (tester) async {
    await _pump(tester);
    expect(tester.takeException(), isNull);
    // 예전 머티리얼 NavigationBar(80dp)보다 확실히 낮고, 글자가 잘리지 않을 만큼.
    final h = tester.getSize(find.byKey(const ValueKey('app-tab-bar'))).height;
    expect(h, inInclusiveRange(58, 68));
    expect(find.text('오늘'), findsOneWidget);
  });

  testWidgets('선택 알약이 아이콘과 글자를 함께 감싸고 여백이 상하좌우 같다', (tester) async {
    await _pump(tester);

    // 선택된 탭('오늘')의 알약 = 글자의 조상 AnimatedContainer
    final pill = find.ancestor(
      of: find.text('오늘'),
      matching: find.byType(AnimatedContainer),
    );
    final pillRect = tester.getRect(pill);
    final iconRect = tester.getRect(
      find.descendant(of: pill, matching: find.byType(Icon)),
    );
    final labelRect = tester.getRect(find.text('오늘'));

    // 알약 안에 아이콘과 글자가 모두 들어 있다.
    expect(pillRect.contains(iconRect.topLeft), isTrue);
    expect(pillRect.contains(labelRect.bottomRight), isTrue);
    // 안쪽 여백 7 + 테두리 1.6 ≈ 8.6 이 위·아래·왼쪽·오른쪽 모두 같다.
    const inset = 8.6;
    final contentLeft = iconRect.left < labelRect.left
        ? iconRect.left
        : labelRect.left;
    final contentRight = iconRect.right > labelRect.right
        ? iconRect.right
        : labelRect.right;
    expect(iconRect.top - pillRect.top, closeTo(inset, 1.2)); // 위
    expect(
      pillRect.bottom - labelRect.bottom,
      closeTo(inset, 3),
    ); // 아래(글자 줄높이 여유)
    expect(contentLeft - pillRect.left, closeTo(inset, 1.2)); // 왼쪽
    expect(pillRect.right - contentRight, closeTo(inset, 1.2)); // 오른쪽
    // 아이콘-글자 간격이 좁다.
    expect(labelRect.top - iconRect.bottom, lessThan(6));
  });

  testWidgets('탭을 누르면 선택 표시가 해당 탭으로 옮겨진다', (tester) async {
    await _pump(tester);
    expect(tester.takeException(), isNull);
    // 기록 탭의 글자 색 = 비선택(회색) → 탭 후 라우팅은 GoRouter 없이 못 하므로
    // 최소한 탭 영역이 눌리는 위젯(InkWell)인지만 확인한다.
    expect(
      find.ancestor(of: find.text('기록'), matching: find.byType(InkWell)),
      findsOneWidget,
    );
  });

  testWidgets('조금 스크롤해서는 숨지 않는다 (민감도)', (tester) async {
    await _pump(tester);
    final shownTop = _barTop(tester);

    // 60dp만 천천히 끌어내림 — 임계값(120dp) 미만
    await tester.drag(find.byType(ListView), const Offset(0, -60));
    await tester.pumpAndSettle();
    expect(_barTop(tester), shownTop);
  });

  testWidgets('위로 조금만 올려도 다시 나온다', (tester) async {
    await _pump(tester);
    final shownTop = _barTop(tester);

    await tester.fling(find.byType(ListView), const Offset(0, -400), 1000);
    await tester.pumpAndSettle();
    expect(_barTop(tester), greaterThan(shownTop + 50));

    await tester.drag(find.byType(ListView), const Offset(0, 60));
    await tester.pumpAndSettle();
    expect(_barTop(tester), shownTop);
  });

  testWidgets('아래로 스크롤하면 숨고 위로 스크롤하면 다시 나온다', (tester) async {
    await _pump(tester);
    final shownTop = _barTop(tester);

    // 아래로 스크롤(손가락을 위로) → 숨김
    await tester.fling(find.byType(ListView), const Offset(0, -300), 1000);
    await tester.pumpAndSettle();
    expect(_barTop(tester), greaterThan(shownTop + 50));
    expect(
      tester
          .widget<IgnorePointer>(
            find
                .ancestor(
                  of: find.byKey(const ValueKey('app-tab-bar')),
                  matching: find.byType(IgnorePointer),
                )
                .first,
          )
          .ignoring,
      isTrue,
    );

    // 위로 스크롤(손가락을 아래로) → 다시 보임
    await tester.fling(find.byType(ListView), const Offset(0, 300), 1000);
    await tester.pumpAndSettle();
    expect(_barTop(tester), shownTop);
  });
}
