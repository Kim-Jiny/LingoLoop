import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/error_message.dart';
import '../../../core/widgets/cartoon.dart';
import '../data/quiz_repository.dart';
import '../domain/quiz_model.dart';
import '../domain/quiz_provider.dart';
import 'quiz_screen.dart';

/// 오늘 문장 카드의 '복습' 버튼이 진입하는 화면. 해당 sentenceId의
/// 4문제(빈칸·어순·번역·객관식)를 풀고 결과만 표시 — 프리미엄 일일 퀴즈
/// 통계와는 분리(서버 attempt.source = 'sentence_review').
///
/// 기존 quiz_screen의 QuizLauncher/QuizOverview/QuizQuestionView/QuizResults를
/// 재사용해 UI 일관성 유지. session source 'sentenceReview' 키로
/// quizSessionProvider 분리.
class SentenceReviewQuizScreen extends ConsumerStatefulWidget {
  final int sentenceId;

  /// 푸시 알림에서 들어온 경우 true — 시작 화면(개요)을 건너뛰고 바로 첫
  /// 문제부터 보여 준다. 앱을 연 직후의 마찰을 줄이려는 용도.
  final bool autoStart;

  const SentenceReviewQuizScreen({
    super.key,
    required this.sentenceId,
    this.autoStart = false,
  });

  @override
  ConsumerState<SentenceReviewQuizScreen> createState() =>
      _SentenceReviewQuizScreenState();
}

class _SentenceReviewQuizScreenState
    extends ConsumerState<SentenceReviewQuizScreen> {
  @override
  void initState() {
    super.initState();
    // 'sentenceReview' 세션은 문장 id와 무관한 고정 키라, 이전 문장에서 풀던
    // 세션/결과가 남아 다른 문장 화면에 그대로 보이던 문제. 진입할 때 비운다.
    // (provider 상태 변경은 build 중 불가 → microtask)
    Future.microtask(() {
      if (!mounted) return;
      ref.read(quizSessionProvider('sentenceReview').notifier).reset();
    });
  }

  /// 한 번만 자동 시작하기 위한 표시(화면이 다시 빌드돼도 중복 시작 방지).
  bool _autoStarted = false;

  void _autoStartOnce(DailyQuiz quiz) {
    if (!widget.autoStart || _autoStarted) return;
    _autoStarted = true;
    // build 중에는 provider 상태를 바꿀 수 없다 → 프레임 뒤에 시작.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final notifier = ref.read(quizSessionProvider('sentenceReview').notifier);
      final unattempted = quiz.quizzes.where((q) => !q.isAttempted).toList();
      notifier.startSession(
        unattempted.isNotEmpty ? unattempted : quiz.quizzes,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final quizAsync = ref.watch(_sentenceReviewQuizProvider(widget.sentenceId));

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('문장 복습')),
      body: quizAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: MascotMessage(
              message: friendlyErrorMessage(e, fallback: '문제를 불러오지 못했어요.'),
            ),
          ),
        ),
        data: (quiz) {
          if (quiz.quizzes.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: MascotMessage(
                  mood: MascotMood.sleepy,
                  message: '아직 풀 수 있는 문제가 준비되지 않았어요.',
                ),
              ),
            );
          }
          _autoStartOnce(quiz);
          return QuizLauncher(quiz: quiz, source: 'sentenceReview');
        },
      ),
    );
  }
}

final _sentenceReviewQuizProvider = FutureProvider.family<DailyQuiz, int>((
  ref,
  sentenceId,
) async {
  final repo = ref.read(quizRepositoryProvider);
  return repo.getSentenceReviewQuiz(sentenceId);
});
