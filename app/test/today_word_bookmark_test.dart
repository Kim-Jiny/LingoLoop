import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:lingoloop/core/analytics/analytics_service.dart';
import 'package:lingoloop/features/auth/domain/auth_model.dart';
import 'package:lingoloop/features/auth/domain/auth_provider.dart';
import 'package:lingoloop/features/progress/domain/progress_model.dart';
import 'package:lingoloop/features/progress/domain/progress_provider.dart';
import 'package:lingoloop/features/sentence/domain/sentence_model.dart';
import 'package:lingoloop/features/sentence/domain/sentence_provider.dart';
import 'package:lingoloop/features/sentence/presentation/today_screen.dart';
import 'package:lingoloop/features/vocabulary/data/vocabulary_repository.dart';
import 'package:lingoloop/features/vocabulary/domain/vocabulary_model.dart';
import 'package:lingoloop/features/vocabulary/domain/vocabulary_provider.dart';
import 'package:mocktail/mocktail.dart';

class _MockVocabRepo extends Mock implements VocabularyRepository {}

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

final _today = TodaySentence.fromJson({
  'assignmentId': 1,
  'assignedDate': '2026-10-29',
  'isCompleted': false,
  'sentence': {
    'id': 7,
    'text': 'I would like to book a table for two.',
    'translation': '2명 자리를 예약하고 싶습니다.',
    'difficulty': 'beginner',
    'words': [
      {'word': 'book', 'meaning': '예약하다'},
      {'word': 'table', 'meaning': '테이블'},
    ],
    'grammarNotes': [],
  },
});

Future<_MockVocabRepo> _pump(
  WidgetTester tester, {
  required List<Map<String, dynamic>> saved,
}) async {
  tester.view.physicalSize = const Size(390 * 3, 1400 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  final repo = _MockVocabRepo();
  when(
    () => repo.add(
      word: any(named: 'word'),
      meaning: any(named: 'meaning'),
      context: any(named: 'context'),
      sentenceId: any(named: 'sentenceId'),
    ),
  ).thenAnswer(
    (_) async => VocabularyItem.fromJson({'id': 99, 'word': 'book'}),
  );
  when(() => repo.remove(any())).thenAnswer((_) async {});

  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        authStateProvider.overrideWith(_FakeAuth.new),
        analyticsServiceProvider.overrideWithValue(_NoAnalytics()),
        todaySentenceProvider.overrideWith((ref) async => _today),
        vocabularyListProvider.overrideWith(
          (ref) async =>
              VocabularyList.fromJson({'total': saved.length, 'items': saved}),
        ),
        vocabularyRepositoryProvider.overrideWithValue(repo),
        heatmapProvider.overrideWith(
          (ref) async => HeatmapData.fromJson({'goal': 3}),
        ),
      ],
      child: const MaterialApp(home: TodayScreen()),
    ),
  );
  await tester.pumpAndSettle();
  return repo;
}

void main() {
  setUpAll(() => registerFallbackValue(0));

  testWidgets('저장 안 된 단어의 북마크를 누르면 단어장에 저장된다', (tester) async {
    final repo = await _pump(tester, saved: const []);
    expect(tester.takeException(), isNull);

    await tester.tap(find.byTooltip('단어장에 저장').first);
    await tester.pumpAndSettle();

    verify(
      () => repo.add(
        word: 'book',
        meaning: '예약하다',
        context: any(named: 'context'),
        sentenceId: 7,
      ),
    ).called(1);
  });

  testWidgets('이미 저장된 단어의 북마크를 누르면 단어장에서 뺄 수 있다', (tester) async {
    final repo = await _pump(
      tester,
      saved: [
        {'id': 5, 'word': 'book', 'status': 'learning'},
      ],
    );

    // 저장됨 상태에서도 눌려야 한다(아무 반응 없는 비활성 버튼이면 안 됨).
    final button = tester.widget<IconButton>(
      find.ancestor(
        of: find.byIcon(Icons.bookmark_rounded),
        matching: find.byType(IconButton),
      ),
    );
    expect(button.onPressed, isNotNull);

    await tester.tap(find.byIcon(Icons.bookmark_rounded));
    await tester.pumpAndSettle();
    verify(() => repo.remove(5)).called(1);
  });
}
