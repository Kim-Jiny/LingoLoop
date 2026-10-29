import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lingoloop/core/widgets/cartoon.dart';
import 'package:lingoloop/features/onboarding/presentation/onboarding_screen.dart';

void main() {
  testWidgets('마스코트·아이콘·국기가 모든 변형에서 예외 없이 그려진다', (tester) async {
    for (final brightness in [Brightness.light, Brightness.dark]) {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(brightness: brightness),
          home: Scaffold(
            body: Wrap(
              children: [
                for (final m in MascotMood.values) Mascot(mood: m, size: 64),
                for (final m in MascotMood.values) Mascot(mood: m, size: 20),
                for (final k in CuteKind.values) CuteIcon(k, size: 18),
                for (final k in CuteKind.values) CuteIcon(k, size: 48),
                for (final c in ['en', 'ja', 'xx']) FlagBadge(code: c, size: 40),
                Text.rich(
                  TextSpan(
                    children: [const TextSpan(text: '달성! '), cuteSpan(CuteKind.party)],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('온보딩 화면이 예외 없이 그려진다', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(child: MaterialApp(home: OnboardingScreen())),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('건너뛰기'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    await tester.pumpAndSettle();
  });
}
