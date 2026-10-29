// 스토어 스크린샷 생성기.
//
// 앱의 실제 화면을 실제 글꼴로 정확한 픽셀 크기에 그린 뒤, 위에 제목 문구를 얹어
// PNG로 저장한다. 평소 `flutter test`에는 포함되지 않는다(tool/ 아래).
//
// 실행:
//   FONT_DIR=<Jua-Regular.ttf, GowunDodum-Regular.ttf가 있는 폴더> \
//   OUT_DIR=<저장할 폴더> \
//   flutter test tool/store_screenshots_test.dart
//
// 광고 배너: 프리미엄 사용자로 그리기 때문에 광고 자리가 아예 생기지 않는다.
//
// 알아 둘 점: 실행이 끝나면 테스트가 "실패"로 표시된다. google_fonts가 글꼴을
// 에셋에서 찾지 못했다는 예외를 비동기로 던지기 때문인데, 글꼴은 위에서 이미
// FontLoader로 불러 두었으므로 이미지는 올바른 글꼴로 그려진다. 성공 여부는
// 종료 코드가 아니라 OUT_DIR에 PNG가 생겼는지(`SHOT ... WxH` 로그)로 판단한다.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lingoloop/core/analytics/analytics_service.dart';
import 'package:lingoloop/core/theme/app_colors.dart';
import 'package:lingoloop/core/theme/app_theme.dart';
import 'package:lingoloop/core/version/store_version_service.dart';
import 'package:lingoloop/core/version/version_gate.dart';
import 'package:lingoloop/core/widgets/cartoon.dart';
import 'package:lingoloop/features/auth/domain/auth_model.dart';
import 'package:lingoloop/features/auth/domain/auth_provider.dart';
import 'package:lingoloop/features/progress/domain/progress_model.dart';
import 'package:lingoloop/features/progress/domain/progress_provider.dart';
import 'package:lingoloop/features/progress/presentation/progress_screen.dart';
import 'package:lingoloop/features/quiz/domain/quiz_model.dart';
import 'package:lingoloop/features/quiz/presentation/quiz_screen.dart';
import 'package:lingoloop/features/review/domain/review_model.dart';
import 'package:lingoloop/features/review/domain/review_provider.dart';
import 'package:lingoloop/features/review/presentation/review_hub_screen.dart';
import 'package:lingoloop/features/sentence/domain/sentence_model.dart';
import 'package:lingoloop/features/sentence/domain/sentence_provider.dart';
import 'package:lingoloop/features/sentence/presentation/today_screen.dart';
import 'package:lingoloop/features/subscription/data/subscription_repository.dart';
import 'package:lingoloop/features/subscription/domain/subscription_provider.dart';
import 'package:lingoloop/features/vocabulary/domain/vocabulary_model.dart';
import 'package:lingoloop/features/vocabulary/domain/vocabulary_provider.dart';
import 'package:lingoloop/features/vocabulary/presentation/vocabulary_screen.dart';
import 'package:package_info_plus/package_info_plus.dart';

final _fontDir = Platform.environment['FONT_DIR'] ?? '';
final _outDir = Platform.environment['OUT_DIR'] ?? '/tmp/lingoloop_store';

/// Flutter SDK의 아이콘 글꼴. 테스트 환경에는 기본으로 없어 아이콘이 네모로 나온다.
final _iconFont =
    Platform.environment['ICON_FONT'] ??
    '${Platform.environment['FLUTTER_ROOT'] ?? '/opt/homebrew/share/flutter'}'
        '/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf';

class _NoAnalytics implements AnalyticsService {
  @override
  dynamic noSuchMethod(Invocation i) => Future<void>.value();
}

/// 프리미엄 사용자 — 광고 배너/광고 자리가 생기지 않고, 퀴즈 등 모든 화면이 열려 있다.
class _PremiumUser extends AuthNotifier {
  @override
  Future<UserInfo?> build() async => UserInfo(
    id: 'u1',
    email: 'hello@lingoloop.app',
    nickname: '링고',
    targetLanguage: 'en',
    nativeLanguage: 'ko',
    subscriptionTier: 'premium',
    dailyGoal: 3,
  );
}

Future<void> _fontFrom(String family, String path) async {
  final bytes = await File(path).readAsBytes();
  final l = FontLoader(family)
    ..addFont(Future.value(ByteData.sublistView(bytes)));
  await l.load();
}

Future<void> _font(String family, String file) =>
    _fontFrom(family, '$_fontDir/$file');

// ───────────────────────────── 가짜 데이터 ─────────────────────────────

final _today = TodaySentence.fromJson({
  'assignmentId': 1,
  'assignedDate': '2026-10-29',
  'isCompleted': false,
  'sentence': {
    'id': 7,
    'text': 'I would like to book a table for two.',
    'translation': '2명 자리를 예약하고 싶습니다.',
    'pronunciation': '아이 우드 라이크 투 북 어 테이블 포 투',
    'situation': '식당',
    'difficulty': 'beginner',
    'words': [
      {
        'word': 'book',
        'meaning': '예약하다',
        'partOfSpeech': 'verb',
        'example': 'I booked a room.',
      },
      {'word': 'table', 'meaning': '테이블, 자리', 'partOfSpeech': 'noun'},
    ],
    'grammarNotes': [
      {
        'title': 'would like to',
        'explanation': '정중하게 원하는 것을 말할 때 쓰는 표현이에요.',
        'example': 'I would like to order.',
      },
    ],
  },
});

HeatmapData _heatmap() {
  // 최근 75일: 대부분 학습, 가끔 쉰 날 — 꾸준한 사용자의 모습.
  final items = <Map<String, dynamic>>[];
  var d = DateTime(2026, 8, 16);
  final end = DateTime(2026, 10, 29);
  var i = 0;
  while (!d.isAfter(end)) {
    final c = [3, 2, 3, 1, 3, 0, 2, 3, 3, 1][i % 10];
    if (c > 0) {
      final m = d.month.toString().padLeft(2, '0');
      final day = d.day.toString().padLeft(2, '0');
      items.add({'date': '${d.year}-$m-$day', 'count': c});
    }
    d = d.add(const Duration(days: 1));
    i++;
  }
  return HeatmapData.fromJson({
    'goal': 3,
    'todayCount': 3,
    'today': '2026-10-29',
    'since': '2026-08-16',
    'items': items,
  });
}

DailyQuiz _quiz() => DailyQuiz.fromJson({
  'total': 4,
  'quizzes': [
    {
      'id': 1,
      'type': 'multiple_choice',
      'sentenceId': 7,
      'isAttempted': false,
      'difficulty': 'beginner',
      'question': {
        'word': 'book',
        'context': 'I would like to book a table for two.',
        'options': ['예약하다', '읽다', '가져오다', '닫다'],
      },
    },
    for (var i = 2; i <= 4; i++)
      {
        'id': i,
        'type': 'fill_blank',
        'sentenceId': 7,
        'isAttempted': false,
        'question': {'sentence': 'a ____ for two', 'translation': '2명 자리'},
      },
  ],
});

List<Override> _common() => [
  authStateProvider.overrideWith(_PremiumUser.new),
  analyticsServiceProvider.overrideWithValue(_NoAnalytics()),
  packageInfoProvider.overrideWith(
    (ref) async => PackageInfo(
      appName: 'LingoLoop',
      packageName: 'com.jiny.lingoloop',
      version: '1.3.0',
      buildNumber: '20',
    ),
  ),
  storeVersionProvider.overrideWith((ref) async => null),
  subscriptionStatusProvider.overrideWith(
    (ref) async => SubscriptionStatus.fromJson({
      'plan': 'premium',
      'isActive': true,
      'subscriptionTier': 'premium',
      'store': 'apple',
    }),
  ),
  heatmapProvider.overrideWith((ref) async => _heatmap()),
  learningStatsProvider.overrideWith(
    (ref) async => LearningStats.fromJson({
      'totalSentences': 84,
      'completedSentences': 72,
      'streak': 14,
      'quizTotalAttempts': 120,
      'quizCorrectCount': 96,
      'quizAccuracy': 80,
      'streakFreezeAvailable': true,
    }),
  ),
  achievementsProvider.overrideWith(
    (ref) async => AchievementSummary.fromJson({}),
  ),
  weeklyReportProvider.overrideWith((ref) async => WeeklyReport.fromJson({})),
  todaySentenceProvider.overrideWith((ref) async => _today),
  reviewQueueProvider.overrideWith(
    (ref) async => ReviewQueue(
      total: 6,
      freeCapped: false,
      freeLimit: null,
      items: [
        for (final t in [
          (
            'Could you tell me the way to the station?',
            '역으로 가는 길을 알려 주시겠어요?',
            2,
          ),
          ('Thank you so much for your help.', '도와주셔서 정말 감사합니다.', 1),
          ('I would like to book a table for two.', '2명 자리를 예약하고 싶습니다.', 0),
        ])
          ReviewItem(
            sentenceId: 1,
            masteryScore: 55,
            overdueDays: t.$3,
            sentence: SentenceDetail.fromJson({
              'id': 1,
              'text': t.$1,
              'translation': t.$2,
            }),
          ),
      ],
    ),
  ),
  vocabularyListProvider.overrideWith(
    (ref) async => VocabularyList.fromJson({
      'total': 5,
      'items': [
        {
          'id': 1,
          'word': 'book',
          'partOfSpeech': 'verb',
          'meaning': '예약하다',
          'status': 'learning',
        },
        {
          'id': 2,
          'word': 'table',
          'partOfSpeech': 'noun',
          'meaning': '테이블, 자리',
          'status': 'learning',
        },
        {
          'id': 3,
          'word': 'station',
          'partOfSpeech': 'noun',
          'meaning': '역',
          'status': 'learning',
        },
        {
          'id': 4,
          'word': 'appreciate',
          'partOfSpeech': 'verb',
          'meaning': '감사하다',
          'status': 'learning',
        },
        {
          'id': 5,
          'word': 'reserve',
          'partOfSpeech': 'verb',
          'meaning': '예약하다',
          'status': 'learning',
        },
      ],
    }),
  ),
];

// ───────────────────────────── 스토어 프레임 ─────────────────────────────

/// 제목 문구 + 앱 화면을 담은 스토어용 한 장. 화면은 아래로 잘려 나가는 기기 틀 안에 둔다.
class _Shot extends StatelessWidget {
  final String title;
  final String subtitle;
  final Widget screen;
  final Color topColor;
  final Color bottomColor;

  /// 화면이 어두운 배경(잠금화면 등)이면 틀 색과 상태 표시줄 글씨를 거기에 맞춘다.
  final Color? frameColor;
  final Color statusInk;

  const _Shot({
    required this.title,
    required this.subtitle,
    required this.screen,
    this.topColor = const Color(0xFFFFF1E2),
    this.bottomColor = const Color(0xFFFFD9B8),
    this.frameColor,
    this.statusInk = const Color(0xFF2D2218),
  });

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [topColor, bottomColor],
        ),
      ),
      child: ClipRect(
        child: Column(
          children: [
            SizedBox(height: w * 0.16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Mascot(mood: MascotMood.cheer, size: w * 0.1),
                SizedBox(width: w * 0.02),
                Text(
                  'LingoLoop',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontSize: w * 0.052,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
            SizedBox(height: w * 0.04),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: w * 0.08),
              child: Text(
                title,
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineLarge?.copyWith(
                  fontSize: w * 0.092,
                  height: 1.22,
                  color: const Color(0xFF2D2218),
                ),
              ),
            ),
            SizedBox(height: w * 0.025),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: w * 0.1),
              child: Text(
                subtitle,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyLarge?.copyWith(
                  fontSize: w * 0.04,
                  color: const Color(0xFF6B5543),
                ),
              ),
            ),
            SizedBox(height: w * 0.06),
            Expanded(
              child: OverflowBox(
                alignment: Alignment.topCenter,
                maxHeight: 4000,
                child: _DeviceFrame(
                  width: w * 0.86,
                  color: frameColor,
                  statusInk: statusInk,
                  child: screen,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 앱 화면을 실제 폰 폭으로 그린 뒤 틀에 맞춰 줄여 넣는 기기 틀. 레이아웃이 실제
/// 기기와 똑같이 나오고(글자가 어색하게 접히지 않음), 아래로 화면 밖까지 이어진다.
class _DeviceFrame extends StatelessWidget {
  final double width;
  final Widget child;
  final Color? color;
  final Color statusInk;
  const _DeviceFrame({
    required this.width,
    required this.child,
    this.color,
    this.statusInk = const Color(0xFF2D2218),
  });

  static const _phoneWidth = 390.0;

  @override
  Widget build(BuildContext context) {
    final r = width * 0.1;
    return Container(
      width: width,
      height: 2400,
      decoration: BoxDecoration(
        color: color ?? AppColors.background,
        borderRadius: BorderRadius.vertical(top: Radius.circular(r)),
        border: Border.all(
          color: const Color(0xFF3B2D22),
          width: width * 0.012,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0xFF3B2D22),
            offset: Offset(0, 8),
            blurRadius: 0,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.vertical(top: Radius.circular(r * 0.9)),
        child: FittedBox(
          fit: BoxFit.fitWidth,
          alignment: Alignment.topCenter,
          child: SizedBox(
            width: _phoneWidth,
            height: 1800,
            child: MediaQuery(
              data: MediaQuery.of(context).copyWith(
                size: const Size(_phoneWidth, 1800),
                padding: EdgeInsets.zero,
                viewPadding: EdgeInsets.zero,
              ),
              child: Column(
                children: [
                  _StatusBar(ink: statusInk),
                  Expanded(child: child),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// 기기 틀 맨 위의 가짜 상태 표시줄(시간·신호·와이파이·배터리).
class _StatusBar extends StatelessWidget {
  final Color ink;
  const _StatusBar({required this.ink});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 46,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(26, 12, 22, 0),
        child: Row(
          children: [
            Text(
              '9:41',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontSize: 16, color: ink),
            ),
            const Spacer(),
            Icon(Icons.signal_cellular_alt, size: 16, color: ink),
            const SizedBox(width: 4),
            Icon(Icons.wifi, size: 16, color: ink),
            const SizedBox(width: 4),
            Icon(Icons.battery_full, size: 18, color: ink),
          ],
        ),
      ),
    );
  }
}

/// 잠금화면 알림 장면(앱 화면이 아니라 알림이 도착한 모습) — 핵심 기능인 푸시를 보여 준다.
class _LockScreen extends StatelessWidget {
  const _LockScreen();

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    Widget card(String title, String body) => Container(
      margin: const EdgeInsets.fromLTRB(14, 0, 14, 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.accent,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Mascot(mood: MascotMood.happy, size: 40),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'LingoLoop',
                      style: t.bodySmall?.copyWith(
                        color: const Color(0xFF6B5543),
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '지금',
                      style: t.bodySmall?.copyWith(
                        color: const Color(0xFF8A7662),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  title,
                  style: t.titleMedium?.copyWith(
                    fontSize: 15,
                    color: const Color(0xFF2D2218),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  body,
                  style: t.bodyMedium?.copyWith(
                    fontSize: 13,
                    color: const Color(0xFF4A3A2C),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFB9825A), Color(0xFF6B4A33)],
        ),
      ),
      child: Column(
        children: [
          const SizedBox(height: 46),
          Text(
            '9:41',
            style: t.displaySmall?.copyWith(fontSize: 62, color: Colors.white),
          ),
          Text(
            '10월 29일 목요일',
            style: t.bodyLarge?.copyWith(
              color: Colors.white.withValues(alpha: 0.9),
            ),
          ),
          const SizedBox(height: 28),
          card('I would like to book a table for two.', '2명 자리를 예약하고 싶습니다.'),
          card('7일 연속이 끊길 수 있어요', '오늘 문장 하나만 학습하면 연속 기록이 이어져요.'),
          card('book', '예약하다'),
        ],
      ),
    );
  }
}

// ───────────────────────────── 실행 ─────────────────────────────

class _Size {
  final String folder;
  final Size logical;
  final double dpr;
  const _Size(this.folder, this.logical, this.dpr);
}

// 물리 픽셀 = logical × dpr 이 정확한 정수가 되도록 고른 조합.
const _sizes = [
  _Size('ios_1179x2556', Size(393, 852), 3),
  _Size('ios_1206x2622', Size(402, 874), 3),
  _Size('android_1080x1920', Size(432, 768), 2.5),
  _Size('android_1080x2160', Size(432, 864), 2.5),
];

class _Spec {
  final String file;
  final String title;
  final String subtitle;
  final Widget Function() screen;
  final Future<void> Function(WidgetTester)? interact;
  final Color top;
  final Color bottom;
  final Color? frameColor;
  final Color statusInk;
  const _Spec(
    this.file,
    this.title,
    this.subtitle,
    this.screen, {
    this.interact,
    this.top = const Color(0xFFFFF1E2),
    this.bottom = const Color(0xFFFFD9B8),
    this.frameColor,
    this.statusInk = const Color(0xFF2D2218),
  });
}

void main() {
  final specs = <_Spec>[
    _Spec(
      '01_today',
      '하루 한 문장,\n부담 없이 시작해요',
      '매일 딱 한 문장이면 충분해요.\n뜻과 발음, 핵심 단어까지 한눈에',
      () => const TodayScreen(),
    ),
    _Spec(
      '02_push',
      '앱을 열지 않아도\n잠금화면에서 만나요',
      '정한 주기에 오늘의 문장이 도착해요',
      () => const _LockScreen(),
      top: const Color(0xFFFFEAD6),
      bottom: const Color(0xFFFFC796),
      frameColor: const Color(0xFFB9825A),
      statusInk: Colors.white,
    ),
    _Spec(
      '03_quiz',
      '빈칸, 어순, 번역으로\n다시 한 번',
      '풀어 보며 기억을 단단하게 만들어요',
      () => Scaffold(
        // QuizLauncher는 원래 Scaffold 안에서 쓰인다(InkWell이 Material을 필요로 함).
        backgroundColor: Colors.transparent,
        appBar: AppBar(title: const Text('퀴즈')),
        body: QuizLauncher(quiz: _quiz(), source: 'today'),
      ),
      interact: (tester) async {
        await tester.tap(find.text('퀴즈 시작하기'), warnIfMissed: false);
        await tester.pump(const Duration(milliseconds: 700));
        // 보기를 하나 선택된 모습으로. 화면 밖으로 잘린 크기에서는 목록이 그 항목을
        // 아예 만들지 않으므로(ListView), 찾지 못하면 선택 없이 그대로 둔다.
        final label = find.text('예약하다');
        if (label.evaluate().isNotEmpty) {
          final option = find
              .ancestor(of: label, matching: find.byType(InkWell))
              .first;
          tester.widget<InkWell>(option).onTap!();
          await tester.pump(const Duration(milliseconds: 400));
        }
      },
    ),
    _Spec(
      '04_review',
      '잊을 때쯤\n다시 꺼내 드려요',
      '망각곡선에 맞춰 복습할 문장을 골라 줘요',
      () => const ReviewHubScreen(),
    ),
    _Spec(
      '05_progress',
      '연속 학습을\n눈으로 확인해요',
      '스트릭과 학습 기록으로 꾸준함을 이어가요',
      () => const ProgressScreen(),
    ),
    _Spec(
      '06_vocab',
      '저장한 단어를\n한곳에 모아요',
      '문장 속 단어를 눌러 나만의 단어장으로',
      () => const VocabularyScreen(),
    ),
  ];

  for (final size in _sizes) {
    for (final spec in specs) {
      testWidgets('${size.folder}/${spec.file}', (tester) async {
        GoogleFonts.config.allowRuntimeFetching = false;
        await tester.runAsync(() async {
          await _font('Jua_regular', 'Jua-Regular.ttf');
          await _font('GowunDodum_regular', 'GowunDodum-Regular.ttf');
          await _fontFrom('MaterialIcons', _iconFont);
        });
        tester.view.physicalSize = Size(
          size.logical.width * size.dpr,
          size.logical.height * size.dpr,
        );
        tester.view.devicePixelRatio = size.dpr;
        addTearDown(tester.view.reset);

        final key = GlobalKey();
        // 사용자·구독 정보를 미리 불러 둔 상태로 시작한다. 안 그러면 첫 프레임에
        // "프리미엄 여부 미확정"으로 보여 광고 배너가 만들어지려 한다.
        final container = ProviderContainer(overrides: _common());
        addTearDown(container.dispose);
        await tester.runAsync(() async {
          await container.read(authStateProvider.future);
          await container.read(subscriptionStatusProvider.future);
        });
        await tester.pumpWidget(
          UncontrolledProviderScope(
            container: container,
            child: MaterialApp(
              debugShowCheckedModeBanner: false,
              theme: AppTheme.light,
              home: RepaintBoundary(
                key: key,
                child: _Shot(
                  title: spec.title,
                  subtitle: spec.subtitle,
                  topColor: spec.top,
                  bottomColor: spec.bottom,
                  frameColor: spec.frameColor,
                  statusInk: spec.statusInk,
                  screen: spec.screen(),
                ),
              ),
            ),
          ),
        );
        for (var i = 0; i < 14; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        if (spec.interact != null) {
          await spec.interact!(tester);
          for (var i = 0; i < 8; i++) {
            await tester.pump(const Duration(milliseconds: 100));
          }
        }

        await tester.runAsync(() async {
          final boundary =
              key.currentContext!.findRenderObject() as RenderRepaintBoundary;
          final image = await boundary.toImage(pixelRatio: size.dpr);
          final data = await image.toByteData(format: ui.ImageByteFormat.png);
          final dir = Directory('$_outDir/${size.folder}')
            ..createSync(recursive: true);
          File(
            '${dir.path}/${spec.file}.png',
          ).writeAsBytesSync(data!.buffer.asUint8List());
          debugPrint(
            'SHOT ${size.folder}/${spec.file} ${image.width}x${image.height}',
          );
        });
      });
    }
  }
}
