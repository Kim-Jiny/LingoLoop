import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lingoloop/features/support/presentation/inquiry_dialog.dart';

Future<void> _open(WidgetTester tester, {String category = 'general'}) async {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        home: Consumer(
          builder: (context, ref, _) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () =>
                    showInquiryDialog(context, ref, category: category),
                child: const Text('열기'),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('열기'));
  await tester.pumpAndSettle();
}

ElevatedButton _sendButton(WidgetTester tester) =>
    tester.widget<ElevatedButton>(
      find.ancestor(
        of: find.text('보내기'),
        matching: find.byType(ElevatedButton),
      ),
    );

void main() {
  testWidgets('열리면 제목·카테고리 칩이 보이고 보내기는 비활성이다', (tester) async {
    await _open(tester);
    expect(tester.takeException(), isNull);
    expect(find.text('문의하기'), findsOneWidget);
    expect(find.text('일반 문의'), findsOneWidget);
    expect(find.text('구독·결제'), findsOneWidget);
    expect(_sendButton(tester).onPressed, isNull);
  });

  testWidgets('구독·결제 칩을 누르면 제목이 바뀐다', (tester) async {
    await _open(tester);
    await tester.tap(find.text('구독·결제'));
    await tester.pumpAndSettle();
    expect(find.text('구독 문의하기'), findsOneWidget);
  });

  testWidgets('한 글자면 안내가 뜨고, 두 글자부터 보내기가 켜진다', (tester) async {
    await _open(tester);
    await tester.enterText(find.byType(TextField), '가');
    await tester.pump();
    expect(find.text('2자 이상 적어 주세요.'), findsOneWidget);
    expect(_sendButton(tester).onPressed, isNull);

    await tester.enterText(find.byType(TextField), '가나');
    await tester.pump();
    expect(find.text('2자 이상 적어 주세요.'), findsNothing);
    expect(_sendButton(tester).onPressed, isNotNull);
  });

  testWidgets('단어 요청 모드는 카테고리 칩이 없고 제목이 고정이다', (tester) async {
    await _open(tester, category: 'word_request');
    expect(find.text('단어 요청하기'), findsOneWidget);
    expect(find.byType(ChoiceChip), findsNothing);
  });

  testWidgets('취소로 닫을 때 애니메이션 중에도 예외가 없다', (tester) async {
    await _open(tester);
    await tester.enterText(find.byType(TextField), '문의 내용');
    await tester.tap(find.text('취소'));
    for (var i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 40));
    }
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('문의하기'), findsNothing);
  });
}
