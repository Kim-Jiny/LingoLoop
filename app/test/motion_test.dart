import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lingoloop/core/widgets/cartoon.dart';

Widget _app(Widget child, {bool disableAnimations = false}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(disableAnimations: disableAnimations),
    child: Scaffold(body: child),
  ),
);

void main() {
  testWidgets('FadeSlideIn: 처음엔 투명하고, 끝나면 완전히 보인다', (tester) async {
    await tester.pumpWidget(_app(const FadeSlideIn(child: Text('안녕'))));
    double opacity() => tester
        .widget<Opacity>(
          find
              .ancestor(of: find.text('안녕'), matching: find.byType(Opacity))
              .first,
        )
        .opacity;
    expect(opacity(), lessThan(0.2));
    await tester.pumpAndSettle();
    expect(opacity(), 1);
  });

  testWidgets('FadeSlideIn: index가 클수록 늦게 시작한다', (tester) async {
    await tester.pumpWidget(
      _app(
        Column(
          children: staggerIn([
            const Text('첫째'),
            const SizedBox(height: 8),
            const Text('둘째'),
            const Text('셋째'),
          ]),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 150));
    double op(String t) => tester
        .widget<Opacity>(
          find.ancestor(of: find.text(t), matching: find.byType(Opacity)).first,
        )
        .opacity;
    expect(op('첫째'), greaterThan(op('둘째')));
    expect(op('둘째'), greaterThan(op('셋째')));
    await tester.pumpAndSettle();
    expect(op('셋째'), 1);
  });

  testWidgets('애니메이션 끄기 설정이면 효과 없이 바로 보인다', (tester) async {
    await tester.pumpWidget(
      _app(const FadeSlideIn(child: Text('바로')), disableAnimations: true),
    );
    expect(
      find.ancestor(of: find.text('바로'), matching: find.byType(Opacity)),
      findsNothing,
    );
  });

  testWidgets('CartoonCard: 누르는 동안 3dp 내려앉고 떼면 돌아온다', (tester) async {
    await tester.pumpWidget(
      _app(
        Center(
          child: CartoonCard(onTap: () {}, child: const Text('카드')),
        ),
      ),
    );
    // 변환은 카드 안쪽 렌더 객체에 적용되므로 안쪽 글자 위치로 측정한다.
    double y() => tester.getCenter(find.text('카드')).dy;
    final rest = y();
    final g = await tester.startGesture(tester.getCenter(find.text('카드')));
    // 눌림 판정(잉크웰 하이라이트)까지의 지연 + 90ms 애니메이션을 지켜본다.
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 300));
    expect(y(), closeTo(rest + 3, 0.5));
    await g.up();
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 300));
    expect(y(), closeTo(rest, 0.5));
  });

  testWidgets('CartoonCard: onTap이 없으면 눌러도 움직이지 않는다', (tester) async {
    await tester.pumpWidget(
      _app(const Center(child: CartoonCard(child: Text('정적')))),
    );
    final rest = tester.getCenter(find.text('정적')).dy;
    final g = await tester.startGesture(tester.getCenter(find.text('정적')));
    await tester.pump(const Duration(milliseconds: 200));
    expect(tester.getCenter(find.text('정적')).dy, rest);
    await g.up();
  });

  testWidgets('AnimatedProgressBar: 0에서 목표값까지 차오른다', (tester) async {
    await tester.pumpWidget(_app(const AnimatedProgressBar(value: 0.6)));
    double v() => tester
        .widget<LinearProgressIndicator>(find.byType(LinearProgressIndicator))
        .value!;
    expect(v(), lessThan(0.1));
    await tester.pumpAndSettle();
    expect(v(), closeTo(0.6, 0.001));
  });

  testWidgets('ShakeOnce: 흔들리다가 제자리로 돌아온다', (tester) async {
    await tester.pumpWidget(
      _app(const Center(child: ShakeOnce(child: Text('흔들')))),
    );
    final rest = tester.getCenter(find.text('흔들')).dx;
    await tester.pump(const Duration(milliseconds: 60));
    expect(
      (tester.getCenter(find.text('흔들')).dx - rest).abs(),
      greaterThan(0.5),
    );
    await tester.pumpAndSettle();
    expect(tester.getCenter(find.text('흔들')).dx, closeTo(rest, 0.01));
  });
}
