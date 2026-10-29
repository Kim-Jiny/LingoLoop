import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// 앱의 스낵바 규칙(일반 2.2초 / 버튼 있는 것 4초 + persist:false)이
// 실제로 자동 소멸하는지 확인한다. Flutter 최신 버전은 action이 있으면
// persist 기본값이 true라 자동으로 안 사라진다.
Future<void> _show(WidgetTester tester, SnackBar bar) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => TextButton(
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(bar),
            child: const Text('토스트'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('토스트'));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 300)); // 나타나는 애니메이션
}

void main() {
  testWidgets('일반 토스트는 2.2초 뒤에 사라진다', (tester) async {
    await _show(
      tester,
      const SnackBar(
        content: Text('저장했어요'),
        duration: Duration(milliseconds: 2200),
      ),
    );
    expect(find.text('저장했어요'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 2000));
    expect(find.text('저장했어요'), findsOneWidget); // 아직
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pumpAndSettle();
    expect(find.text('저장했어요'), findsNothing);
  });

  testWidgets('기본값(지정 안 함)이면 4초 동안 남아 있다 — 그래서 줄였다', (tester) async {
    await _show(tester, const SnackBar(content: Text('기본')));
    await tester.pump(const Duration(milliseconds: 3000));
    expect(find.text('기본'), findsOneWidget);
  });

  testWidgets('버튼 달린 토스트: persist 기본값이면 안 사라진다 (원래 문제)', (tester) async {
    await _show(
      tester,
      SnackBar(
        content: const Text('되돌릴래요?'),
        action: SnackBarAction(label: '되돌리기', onPressed: () {}),
      ),
    );
    await tester.pump(const Duration(seconds: 30));
    expect(find.text('되돌릴래요?'), findsOneWidget);
  });

  testWidgets('버튼 달린 토스트: persist:false + 4초면 사라진다 (수정 후)', (tester) async {
    await _show(
      tester,
      SnackBar(
        content: const Text('되돌릴래요?'),
        duration: const Duration(seconds: 4),
        persist: false,
        action: SnackBarAction(label: '되돌리기', onPressed: () {}),
      ),
    );
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    expect(find.text('되돌릴래요?'), findsNothing);
  });
}
