part of 'quiz_screen.dart';

class QuizResults extends ConsumerWidget {
  final QuizSessionState session;

  const QuizResults({super.key, required this.session});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // 여기까지 풀기로 끝낸 세션은 attemptedCount 기준 — 안 푼 문제까지
    // 분모로 잡으면 "10문제 중 3문제 맞췄어요" 같은 오해 유발.
    final total = session.finishedEarly
        ? session.attemptedCount
        : session.quizzes.length;
    final correct = session.correctCount;
    final percentage = total > 0 ? (correct / total * 100).round() : 0;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
      children: [
        CartoonCard(
          padding: const EdgeInsets.all(28),
          radius: 28,
          // 점수대별 옅은 색 — 다크 모드에서도 글자(테마색)가 읽히도록 불투명 합성.
          color: Color.alphaBlend(
            (percentage >= 80
                    ? AppColors.success
                    : percentage >= 50
                    ? AppColors.warning
                    : AppColors.primary)
                .withValues(alpha: 0.22),
            AppColors.surfaceStrong,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              BounceIn(
                child: Mascot(
                  size: 64,
                  mood: percentage >= 80
                      ? MascotMood.cheer
                      : percentage >= 50
                      ? MascotMood.happy
                      : MascotMood.think,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                percentage >= 80
                    ? '훌륭해요!'
                    : percentage >= 50
                    ? '잘하고 있어요!'
                    : '한 번 더 돌려볼까요?',
                style: Theme.of(
                  context,
                ).textTheme.headlineMedium,
              ),
              const SizedBox(height: 10),
              Text(
                '$total문제 중 $correct문제를 맞췄어요. 오늘 문장을 다시 한 바퀴 돌리면 더 단단해집니다.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 18),
              Text(
                '$percentage%',
                style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  fontSize: 40,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _ScoreStat(
                label: '정답',
                count: correct,
                color: AppColors.success,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _ScoreStat(
                label: '오답',
                count: total - correct,
                color: AppColors.error,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _ScoreStat(
                label: '총 문제',
                count: total,
                color: AppColors.primary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: () {
            // Drop the session and refetch every tab's source — the
            // user may have just finished the review queue and we
            // want today's quiz / word quiz to reflect any progress
            // bumps too.
            ref.read(quizSessionProvider(session.source).notifier).reset();
            ref.invalidate(todayQuizProvider);
            ref.invalidate(wordLearningQuizProvider);
            ref.invalidate(wordReviewQuizProvider);
            ref.invalidate(sentenceTypingQuizProvider);
            ref.invalidate(dailyQuizProvider);
            ref.invalidate(reviewQueueProvider);
            ref.invalidate(wordQuizProvider);
            ref.invalidate(wordListeningQuizProvider);
            ref.invalidate(sentenceListeningQuizProvider);
            ref.invalidate(sentenceArrangeQuizProvider);
            ref.invalidate(quizProgressProvider);
          },
          child: const Text('퀴즈 화면으로 돌아가기'),
        ),
      ],
    );
  }
}

class _ScoreStat extends StatelessWidget {
  final String label;
  final int count;
  final Color color;

  const _ScoreStat({
    required this.label,
    required this.count,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return CartoonCard(
      padding: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 18),
        child: Column(
          children: [
            Text(
              '$count',
              style: Theme.of(
                context,
              ).textTheme.headlineMedium?.copyWith(color: color),
            ),
            const SizedBox(height: 6),
            Text(label, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
