import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lingoloop/features/progress/domain/progress_model.dart';
import 'package:lingoloop/features/progress/domain/progress_provider.dart';
import 'package:lingoloop/features/progress/presentation/progress_screen.dart';

void main() {
  // 회귀 방지: 화면 구성을 바꿀 때 레이아웃 예외(무한 높이 등)로 화면이
  // 통째로 비는 사고를 잡는다.
  for (final streak in [0, 7]) {
    testWidgets('기록 화면이 예외 없이 그려진다 (streak=$streak)', (tester) async {
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            learningStatsProvider.overrideWith(
              (ref) async => LearningStats.fromJson({
                'totalSentences': 12,
                'completedSentences': 9,
                'streak': streak,
                'quizTotalAttempts': 5,
                'quizCorrectCount': 4,
                'quizAccuracy': 80,
              }),
            ),
            achievementsProvider.overrideWith(
              (ref) async => AchievementSummary.fromJson({}),
            ),
            weeklyReportProvider.overrideWith(
              (ref) async => WeeklyReport.fromJson({}),
            ),
            heatmapProvider.overrideWith(
              (ref) async => HeatmapData.fromJson({}),
            ),
          ],
          child: const MaterialApp(home: ProgressScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('반복이 실력으로 바뀌는 중'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
      await tester.pumpAndSettle();
    });
  }
}
