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

  // 스트릭 프리즈 표시: 서버가 주는 값에 따라 문구가 바뀌고, 옛 서버 응답(필드
  // 없음)도 깨지지 않아야 한다.
  final freezeCases = <String, (Map<String, dynamic>, String)>{
    '사용 가능': (
      {'streakFreezeAvailable': true, 'streakFrozenDates': <String>[]},
      '이번 주 얼음 1개',
    ),
    '쓴 직후': (
      {
        'streakFreezeAvailable': false,
        'streakFrozenDates': ['2026-01-06'],
      },
      '얼음으로 연속 기록을 지켰어요',
    ),
    '모두 소진': (
      {'streakFreezeAvailable': false, 'streakFrozenDates': <String>[]},
      '이번 주 얼음을 다 썼어요',
    ),
  };
  for (final e in freezeCases.entries) {
    testWidgets('스트릭 프리즈 표시 — ${e.key}', (tester) async {
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
                'streak': 5,
                'quizTotalAttempts': 5,
                'quizCorrectCount': 4,
                'quizAccuracy': 80,
                ...e.value.$1,
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
      expect(find.textContaining(e.value.$2), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      await tester.pumpAndSettle();
    });
  }

  test('옛 서버 응답(프리즈 필드 없음)도 파싱된다', () {
    final s = LearningStats.fromJson({'streak': 3});
    expect(s.streakFrozenDates, isEmpty);
    expect(s.streakFreezeAvailable, isFalse);
  });

  testWidgets('연속 기록이 없으면 프리즈 안내를 숨긴다', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          learningStatsProvider.overrideWith(
            (ref) async => LearningStats.fromJson({
              'streak': 0,
              'streakFreezeAvailable': true,
            }),
          ),
          achievementsProvider.overrideWith(
            (ref) async => AchievementSummary.fromJson({}),
          ),
          weeklyReportProvider.overrideWith(
            (ref) async => WeeklyReport.fromJson({}),
          ),
          heatmapProvider.overrideWith((ref) async => HeatmapData.fromJson({})),
        ],
        child: const MaterialApp(home: ProgressScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('얼음'), findsNothing);
    await tester.pumpWidget(const SizedBox());
    await tester.pumpAndSettle();
  });
}
