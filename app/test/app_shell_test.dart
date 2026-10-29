import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lingoloop/core/widgets/app_shell.dart';
import 'package:lingoloop/features/subscription/data/subscription_repository.dart';
import 'package:lingoloop/features/subscription/domain/subscription_provider.dart';

const _barKey = ValueKey('app-tab-bar');
const _pillKey = ValueKey('tab-pill');

/// 실제 GoRouter + ShellRoute로 AppShell을 띄운다 (탭/스와이프가 화면을 바꾼다).
Future<GoRouter> _pump(WidgetTester tester, {double bottomInset = 0}) async {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  final router = GoRouter(
    initialLocation: '/',
    routes: [
      ShellRoute(
        builder: (context, state, child) =>
            AppShell(location: state.uri.toString(), child: child),
        routes: [
          GoRoute(
            path: '/',
            builder: (_, _) => ListView(
              children: [
                for (var i = 0; i < 60; i++) ListTile(title: Text('row $i')),
              ],
            ),
          ),
          for (final p in ['review', 'progress', 'settings'])
            GoRoute(
              path: '/$p',
              builder: (_, _) => Center(child: Text('$p page')),
            ),
        ],
      ),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        subscriptionStatusProvider.overrideWith(
          (ref) async => SubscriptionStatus.fromJson({}),
        ),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            padding: EdgeInsets.only(bottom: bottomInset),
            viewPadding: EdgeInsets.only(bottom: bottomInset),
          ),
          child: child!,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

Rect _bar(WidgetTester tester) => tester.getRect(find.byKey(_barKey));
Rect _pill(WidgetTester tester) => tester.getRect(find.byKey(_pillKey));
Offset _tabCenter(WidgetTester tester, String label) =>
    tester.getCenter(find.text(label));

void main() {
  testWidgets('탭바 높이가 60dp이고 예외 없이 그려진다', (tester) async {
    await _pump(tester);
    expect(tester.takeException(), isNull);
    expect(_bar(tester).height, closeTo(60, 1));
    expect(find.text('오늘'), findsOneWidget);
  });

  testWidgets('알약과 탭바 테두리 사이 간격이 위·아래·왼쪽·오른쪽 모두 같다', (tester) async {
    final router = await _pump(tester);
    final bar = _bar(tester);

    var pill = _pill(tester);
    final top = pill.top - bar.top;
    expect(bar.bottom - pill.bottom, closeTo(top, 0.6));
    expect(pill.left - bar.left, closeTo(top, 1.6)); // 왼쪽(맨 처음 칸)

    router.go('/settings');
    await tester.pumpAndSettle();
    pill = _pill(tester);
    expect(bar.right - pill.right, closeTo(top, 1.6)); // 오른쪽(맨 끝 칸)
  });

  testWidgets('선택 알약 안에 아이콘과 글자가 모두 들어 있고 간격이 좁다', (tester) async {
    await _pump(tester);
    final pill = _pill(tester);
    final icon = tester.getRect(
      find.descendant(
        of: find.byKey(_barKey),
        matching: find.byIcon(Icons.wb_sunny),
      ),
    );
    final label = tester.getRect(find.text('오늘'));
    expect(pill.contains(icon.topLeft), isTrue);
    expect(pill.contains(label.bottomRight), isTrue);
    expect(label.top - icon.bottom, lessThan(6));
  });

  // 회귀: Stack 안의 Row가 높이를 채우지 않아 아이콘·글자가 위로 쏠렸다.
  testWidgets('아이콘+글자 묶음이 알약의 세로 가운데에 있다', (tester) async {
    await _pump(tester);
    final pill = _pill(tester);
    final icon = tester.getRect(find.byIcon(Icons.wb_sunny));
    final label = tester.getRect(find.text('오늘'));
    final contentCenter = (icon.top + label.bottom) / 2;
    expect(contentCenter, closeTo(pill.center.dy, 1.5));
    // 위 여백과 아래 여백이 거의 같다.
    expect((icon.top - pill.top) - (pill.bottom - label.bottom), closeTo(0, 3));
  });

  testWidgets('탭 영역이 알약 높이 전체를 덮는다', (tester) async {
    final router = await _pump(tester);
    final pill = _pill(tester);
    // 비선택 '복습' 칸의 맨 위쪽 가장자리 근처를 눌러도 이동해야 한다.
    final review = tester.getCenter(find.text('복습'));
    await tester.tapAt(Offset(review.dx, pill.top + 3));
    await tester.pumpAndSettle();
    expect(router.state.uri.toString(), '/review');
  });

  testWidgets('탭하면 그 화면으로 이동하고 알약이 그 칸으로 미끄러진다', (tester) async {
    final router = await _pump(tester);
    final before = _pill(tester).center.dx;

    await tester.tap(find.text('복습'));
    await tester.pumpAndSettle();

    expect(router.state.uri.toString(), '/review');
    expect(find.text('review page'), findsOneWidget);
    expect(_pill(tester).center.dx, greaterThan(before + 50));
    expect(tester.takeException(), isNull);
  });

  testWidgets('좌우로 스와이프하면 알약이 손가락을 따라가고, 떼면 그 탭으로 이동한다', (tester) async {
    final router = await _pump(tester);
    final gesture = await tester.startGesture(_tabCenter(tester, '오늘'));
    await gesture.moveBy(const Offset(30, 0));
    await tester.pump();

    // '기록' 칸 한가운데까지 끌기 — 손을 떼기 전에도 알약은 이미 거기 있다.
    final target = _tabCenter(tester, '기록');
    await gesture.moveTo(Offset(target.dx, _tabCenter(tester, '오늘').dy));
    await tester.pump();
    expect(_pill(tester).center.dx, closeTo(target.dx, 2));
    expect(router.state.uri.toString(), '/'); // 아직 떼지 않았으니 이동 전

    await gesture.up();
    await tester.pumpAndSettle();
    expect(router.state.uri.toString(), '/progress');
    expect(find.text('progress page'), findsOneWidget);
    expect(_pill(tester).center.dx, closeTo(target.dx, 2));
    expect(tester.takeException(), isNull);
  });

  testWidgets('오른쪽 끝을 넘어 끌어도 알약은 바 밖으로 나가지 않는다', (tester) async {
    final router = await _pump(tester);
    final bar = _bar(tester);
    final gesture = await tester.startGesture(_tabCenter(tester, '오늘'));
    await gesture.moveBy(const Offset(30, 0));
    await gesture.moveTo(Offset(bar.right - 2, _tabCenter(tester, '오늘').dy));
    await tester.pump();
    expect(_pill(tester).right, lessThanOrEqualTo(bar.right));
    await gesture.up();
    await tester.pumpAndSettle();
    expect(router.state.uri.toString(), '/settings');
  });

  testWidgets('같은 칸 안에서 조금만 끌었다 놓으면 이동하지 않는다', (tester) async {
    final router = await _pump(tester);
    final start = _tabCenter(tester, '오늘');
    final gesture = await tester.startGesture(start);
    await gesture.moveBy(const Offset(22, 0));
    await tester.pump();
    await gesture.up();
    await tester.pumpAndSettle();

    expect(router.state.uri.toString(), '/');
    expect(_pill(tester).left - _bar(tester).left, lessThan(12));
  });

  testWidgets('왼쪽으로 스와이프해서 이전 탭으로 돌아갈 수 있다', (tester) async {
    final router = await _pump(tester);
    router.go('/settings');
    await tester.pumpAndSettle();

    final gesture = await tester.startGesture(_tabCenter(tester, '설정'));
    await gesture.moveBy(const Offset(-30, 0));
    await gesture.moveTo(
      Offset(_tabCenter(tester, '복습').dx, _tabCenter(tester, '설정').dy),
    );
    await gesture.up();
    await tester.pumpAndSettle();

    expect(router.state.uri.toString(), '/review');
    expect(tester.takeException(), isNull);
  });

  testWidgets('조금 스크롤해서는 숨지 않는다 (민감도)', (tester) async {
    await _pump(tester);
    final shownTop = _bar(tester).top;

    await tester.drag(find.byType(ListView), const Offset(0, -60));
    await tester.pumpAndSettle();
    expect(_bar(tester).top, shownTop);
  });

  testWidgets('아래로 스크롤하면 숨고, 위로 조금만 올려도 다시 나온다', (tester) async {
    await _pump(tester);
    final shownTop = _bar(tester).top;

    await tester.fling(find.byType(ListView), const Offset(0, -400), 1000);
    await tester.pumpAndSettle();
    expect(_bar(tester).top, greaterThan(shownTop + 50));
    expect(
      tester
          .widget<IgnorePointer>(
            find
                .ancestor(
                  of: find.byKey(_barKey),
                  matching: find.byType(IgnorePointer),
                )
                .first,
          )
          .ignoring,
      isTrue,
    );

    await tester.drag(find.byType(ListView), const Offset(0, 60));
    await tester.pumpAndSettle();
    expect(_bar(tester).top, shownTop);
  });

  // 안드로이드: 시스템 내비게이션 바 위로 여백을 더 띄운다.
  testWidgets('안드로이드는 시스템 바(48dp) 위에 12dp를 더 띄운다', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    await _pump(tester, bottomInset: 48);

    final screenH =
        tester.view.physicalSize.height / tester.view.devicePixelRatio;
    expect(screenH - _bar(tester).bottom, closeTo(60, 0.5));
    debugDefaultTargetPlatformOverride = null;
  });

  testWidgets('iOS는 홈 인디케이터 높이를 그대로 쓴다', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    await _pump(tester, bottomInset: 34);

    final screenH =
        tester.view.physicalSize.height / tester.view.devicePixelRatio;
    expect(screenH - _bar(tester).bottom, closeTo(34, 0.5));
    debugDefaultTargetPlatformOverride = null;
  });
}
