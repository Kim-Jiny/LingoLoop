import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/quiz_repository.dart';
import '../domain/quiz_model.dart';
import 'quiz_screen.dart';

/// 오늘 문장 카드의 '복습' 버튼이 진입하는 화면. 해당 sentenceId의
/// 4문제(빈칸·어순·번역·객관식)를 풀고 결과만 표시 — 프리미엄 일일 퀴즈
/// 통계와는 분리(서버 attempt.source = 'sentence_review').
///
/// 기존 quiz_screen의 QuizLauncher/QuizOverview/QuizQuestionView/QuizResults를
/// 재사용해 UI 일관성 유지. session source 'sentenceReview' 키로
/// quizSessionProvider 분리.
class SentenceReviewQuizScreen extends ConsumerWidget {
  final int sentenceId;

  const SentenceReviewQuizScreen({super.key, required this.sentenceId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quizAsync = ref.watch(_sentenceReviewQuizProvider(sentenceId));

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('문장 복습')),
      body: quizAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('문제를 불러오지 못했어요.\n$e', textAlign: TextAlign.center),
          ),
        ),
        data: (quiz) {
          if (quiz.quizzes.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text('아직 풀 수 있는 문제가 준비되지 않았어요.'),
              ),
            );
          }
          return QuizLauncher(quiz: quiz, source: 'sentenceReview');
        },
      ),
    );
  }
}

final _sentenceReviewQuizProvider =
    FutureProvider.family<DailyQuiz, int>((ref, sentenceId) async {
  final repo = ref.read(quizRepositoryProvider);
  return repo.getSentenceReviewQuiz(sentenceId);
});
