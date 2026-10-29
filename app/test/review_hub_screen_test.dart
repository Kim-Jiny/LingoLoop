import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lingoloop/features/auth/domain/auth_provider.dart';
import 'package:lingoloop/features/auth/domain/auth_model.dart';
import 'package:lingoloop/features/review/domain/review_model.dart';
import 'package:lingoloop/features/review/domain/review_provider.dart';
import 'package:lingoloop/features/review/presentation/review_hub_screen.dart';

class _NoUser extends AuthNotifier {
  @override
  Future<UserInfo?> build() async => null;
}

Future<void> _pumpHub(WidgetTester tester, {required int due}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authStateProvider.overrideWith(_NoUser.new),
        reviewQueueProvider.overrideWith(
          (ref) async => ReviewQueue(
            total: due,
            freeCapped: false,
            freeLimit: null,
            items: const [],
          ),
        ),
      ],
      child: const MaterialApp(home: ReviewHubScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  // 회귀: ListView 안의 Row(crossAxisAlignment: stretch)는 높이가 무한이라
  // 렌더 예외가 나고 복습 탭이 빈 화면이 됐다.
  for (final due in [0, 3]) {
    testWidgets('복습 허브가 예외 없이 그려진다 (due=$due)', (tester) async {
      await _pumpHub(tester, due: due);

      expect(tester.takeException(), isNull);
      expect(find.text('단어장'), findsOneWidget);
      expect(find.text('퀴즈'), findsOneWidget);
      expect(find.text('복습 시작'), due > 0 ? findsOneWidget : findsNothing);

      // 위젯 트리를 내려 대기 중인 타이머가 남지 않는지도 확인.
      await tester.pumpWidget(const SizedBox());
      await tester.pumpAndSettle();
    });
  }
}
