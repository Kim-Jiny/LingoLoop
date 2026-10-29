import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lingoloop/core/widgets/app_shell.dart';
import 'package:lingoloop/features/subscription/data/subscription_repository.dart';
import 'package:lingoloop/features/subscription/domain/subscription_provider.dart';

Future<void> _pump(
  WidgetTester tester, {
  String location = '/',
  double bottomInset = 0,
}) async {
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
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            padding: EdgeInsets.only(bottom: bottomInset),
            viewPadding: EdgeInsets.only(bottom: bottomInset),
          ),
          child: child!,
        ),
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
    // 처음 요청대로 60dp (예전 머티리얼 NavigationBar는 80dp).
    final h = tester.getSize(find.byKey(const ValueKey('app-tab-bar'))).height;
    expect(h, closeTo(60, 1));
    expect(find.text('오늘'), findsOneWidget);
  });

  testWidgets('알약과 탭바 테두리 사이 간격이 위·아래·왼쪽·오른쪽 모두 같다', (tester) async {
    await _pump(tester);
    final bar = tester.getRect(find.byKey(const ValueKey('app-tab-bar')));

    Rect pillOf(String label) => tester.getRect(
      find.ancestor(
        of: find.text(label),
        matching: find.byType(AnimatedContainer),
      ),
    );
    // 알약 외곽(margin 제외)을 얻기 위해 AnimatedContainer 자체 영역을 쓴다.
    final first = pillOf('오늘'); // 맨 왼쪽
    final last = pillOf('설정'); // 맨 오른쪽

    final top = first.top - bar.top;
    final bottom = bar.bottom - first.bottom;
    final left = first.left - bar.left;
    final right = bar.right - last.right;

    // 사방 간격이 같다 (알약 margin 1dp 포함 오차 허용).
    expect(bottom, closeTo(top, 0.6));
    expect(left, closeTo(top, 1.6));
    expect(right, closeTo(top, 1.6));
    // 알약은 탭 칸을 채운다: 폭이 바 폭의 약 1/4.
    expect(first.width, greaterThan(bar.width / 4 - 14));
  });

  testWidgets('선택 알약 안에 아이콘과 글자가 모두 들어 있다', (tester) async {
    await _pump(tester);
    final pill = tester.getRect(
      find.ancestor(
        of: find.text('오늘'),
        matching: find.byType(AnimatedContainer),
      ),
    );
    final icon = tester.getRect(
      find.descendant(
        of: find.ancestor(
          of: find.text('오늘'),
          matching: find.byType(AnimatedContainer),
        ),
        matching: find.byType(Icon),
      ),
    );
    final label = tester.getRect(find.text('오늘'));
    expect(pill.contains(icon.topLeft), isTrue);
    expect(pill.contains(label.bottomRight), isTrue);
    // 아이콘-글자 간격이 좁다.
    expect(label.top - icon.bottom, lessThan(6));
  });

  testWidgets('눌림 효과는 알약 안에만 보이고, 탭 영역은 4등분 폭이다', (tester) async {
    await _pump(tester);
    final bar = tester.getRect(find.byKey(const ValueKey('app-tab-bar')));

    // 비선택 탭('기록'): 탭 영역 = 바 폭의 1/4 근처(넓다), 알약 = 내용에 맞게 좁다.
    final area = tester.getRect(
      find
          .ancestor(of: find.text('기록'), matching: find.byType(GestureDetector))
          .first,
    );
    final pill = tester.getRect(
      find.ancestor(
        of: find.text('기록'),
        matching: find.byType(AnimatedContainer),
      ),
    );
    expect(area.width, greaterThan(bar.width / 4 - 10));
    // 알약이 탭 칸을 거의 채우므로 눌림 효과 영역 = 알약 영역.
    expect(pill.width, greaterThan(area.width * 0.9));

    // 누르는 동안(손가락을 떼기 전)만 알약 색이 생기고, 물결(InkWell)은 없다.
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('app-tab-bar')),
        matching: find.byType(InkWell),
      ),
      findsNothing,
    );
    BoxDecoration deco() =>
        tester
                .widget<AnimatedContainer>(
                  find.ancestor(
                    of: find.text('기록'),
                    matching: find.byType(AnimatedContainer),
                  ),
                )
                .decoration!
            as BoxDecoration;
    expect(deco().color, Colors.transparent);

    final gesture = await tester.startGesture(
      tester.getCenter(find.text('기록')),
    );
    await tester.pump(const Duration(milliseconds: 250));
    expect(deco().color, isNot(Colors.transparent));
    // up()은 실제 탭 → context.go(라우터 없음). 취소로 눌림 해제만 확인.
    await gesture.cancel();
    await tester.pump(const Duration(milliseconds: 250));
    expect(deco().color, Colors.transparent);
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

  // 안드로이드: 시스템 내비게이션 바 위로 여백을 더 띄운다.
  testWidgets('안드로이드는 시스템 바(48dp) 위에 12dp를 더 띄운다', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    await _pump(tester, bottomInset: 48);

    final screenH =
        tester.view.physicalSize.height / tester.view.devicePixelRatio;
    final bar = tester.getRect(find.byKey(const ValueKey('app-tab-bar')));
    // 탭바 아래쪽에서 화면 끝까지 = 시스템 바 48 + 여백 12
    expect(screenH - bar.bottom, closeTo(60, 0.5));
    debugDefaultTargetPlatformOverride = null;
  });

  testWidgets('iOS는 홈 인디케이터 높이를 그대로 쓴다', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    await _pump(tester, bottomInset: 34);

    final screenH =
        tester.view.physicalSize.height / tester.view.devicePixelRatio;
    final bar = tester.getRect(find.byKey(const ValueKey('app-tab-bar')));
    expect(screenH - bar.bottom, closeTo(34, 0.5));
    debugDefaultTargetPlatformOverride = null;
  });
}
