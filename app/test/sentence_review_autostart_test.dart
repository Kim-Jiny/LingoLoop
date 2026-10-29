import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:lingoloop/core/analytics/analytics_service.dart';
import 'package:lingoloop/features/auth/domain/auth_model.dart';
import 'package:lingoloop/features/auth/domain/auth_provider.dart';
import 'package:lingoloop/features/notification/data/push_service.dart';
import 'package:lingoloop/features/quiz/data/quiz_repository.dart';
import 'package:lingoloop/features/quiz/domain/quiz_model.dart';
import 'package:lingoloop/features/quiz/presentation/sentence_review_quiz_screen.dart';
import 'package:mocktail/mocktail.dart';

class _MockQuizRepo extends Mock implements QuizRepository {}

class _NoAnalytics implements AnalyticsService {
  @override
  dynamic noSuchMethod(Invocation i) => Future<void>.value();
}

class _FakeAuth extends AuthNotifier {
  @override
  Future<UserInfo?> build() async => UserInfo(
    id: 'u1',
    email: 'a@b.c',
    nickname: '링고',
    targetLanguage: 'en',
    nativeLanguage: 'ko',
    subscriptionTier: 'free',
    dailyGoal: 3,
  );
}

DailyQuiz _quiz() => DailyQuiz.fromJson({
  'total': 2,
  'quizzes': [
    for (var i = 1; i <= 2; i++)
      {
        'id': i,
        'type': 'fill_blank',
        'sentenceId': 7,
        'isAttempted': false,
        'difficulty': 'beginner',
        'question': {
          'sentence': 'I would like to ____ a table.',
          'fullSentence': 'I would like to book a table.',
          'hint': 'b___',
          'translation': '테이블을 예약하고 싶어요.',
        },
      },
  ],
});

Future<void> _pump(WidgetTester tester, {required bool autoStart}) async {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  final repo = _MockQuizRepo();
  when(
    () => repo.getSentenceReviewQuiz(any()),
  ).thenAnswer((_) async => _quiz());

  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        authStateProvider.overrideWith(_FakeAuth.new),
        analyticsServiceProvider.overrideWithValue(_NoAnalytics()),
        quizRepositoryProvider.overrideWithValue(repo),
      ],
      child: MaterialApp(
        home: SentenceReviewQuizScreen(sentenceId: 7, autoStart: autoStart),
      ),
    ),
  );
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  pushRouteTests();
  testWidgets('푸시에서 들어오면(autoStart) 시작 화면 없이 첫 문제가 바로 보인다', (tester) async {
    await _pump(tester, autoStart: true);
    expect(tester.takeException(), isNull);
    expect(find.text('퀴즈 시작하기'), findsNothing);
    expect(find.text('1 / 2'), findsOneWidget); // 첫 문제 진행 표시
    expect(find.byType(TextField), findsOneWidget);
  });

  testWidgets('일반 진입은 기존처럼 시작 화면이 먼저 보인다', (tester) async {
    await _pump(tester, autoStart: false);
    expect(find.text('퀴즈 시작하기'), findsOneWidget);
    expect(find.text('1 / 2'), findsNothing);
  });
}

// 푸시 탭 → 경로 결정 (옛 서버/옛 푸시와의 호환 포함)
void pushRouteTests() {
  group('quickQuizPathFor', () {
    test('quickQuiz=1 이고 sentenceId가 있으면 바로 문제 경로', () {
      expect(
        quickQuizPathFor({
          'sentenceId': '7',
          'quickQuiz': '1',
          'action': 'today',
        }),
        '/sentence-review/7?quick=1',
      );
    });
    test('옛 푸시(quickQuiz 없음)는 null — 오늘 화면만', () {
      expect(quickQuizPathFor({'sentenceId': '7', 'action': 'today'}), isNull);
    });
    test('sentenceId가 없거나 숫자가 아니면 null', () {
      expect(quickQuizPathFor({'quickQuiz': '1'}), isNull);
      expect(quickQuizPathFor({'quickQuiz': '1', 'sentenceId': 'abc'}), isNull);
    });
    test('스트릭 위기 푸시는 문제 경로가 아니다', () {
      expect(
        quickQuizPathFor({'type': 'streak_risk', 'action': 'today'}),
        isNull,
      );
    });
  });
}
