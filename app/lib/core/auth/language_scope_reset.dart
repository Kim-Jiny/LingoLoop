import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../widget/home_widget_service.dart';
import '../../features/progress/domain/progress_provider.dart';
import '../../features/quiz/domain/quiz_provider.dart' as quiz;
import '../../features/review/domain/review_provider.dart' as review;
import '../../features/sentence/domain/sentence_provider.dart';
import '../../features/vocabulary/domain/vocabulary_provider.dart';

/// 학습 언어가 바뀌었을 때 무효화해야 하는 provider 일괄 정리.
///
/// `resetUserScopedState`(계정 전환)보다 가볍게 — 구독/문의/알림 설정 같은
/// 유저-스코프지만 언어 무관한 캐시는 유지. 콘텐츠/통계/홈 위젯만 새로
/// 그림.
///
/// 호출 시점: `AuthNotifier.updateProfile`에서 `targetLanguage`가 실제로
/// 바뀌었을 때 + 설정 화면에서 언어 변경 후. 이중 호출은 멱등(invalidate는
/// 추가 효과 없음).
void resetLanguageScopedState(Ref ref) {
  // 현재 언어의 today/vocab/review 콘텐츠
  ref.invalidate(todaySentenceProvider);
  ref.invalidate(vocabularyListProvider);
  ref.invalidate(review.reviewQueueProvider);

  // 진도/스탯 — 언어별로 집계되므로 새로 받아야 정확.
  ref.invalidate(learningStatsProvider);
  ref.invalidate(achievementsProvider);
  ref.invalidate(weeklyReportProvider);
  ref.invalidate(heatmapProvider);
  ref.invalidate(sentenceProgressProvider);

  // 퀴즈는 모두 언어 필터 — 새 언어 풀에서 다시 생성.
  ref.invalidate(quiz.dailyQuizProvider);
  ref.invalidate(quiz.reviewQueueProvider);
  ref.invalidate(quiz.wordQuizProvider);
  ref.invalidate(quiz.wordListeningQuizProvider);
  ref.invalidate(quiz.sentenceListeningQuizProvider);
  ref.invalidate(quiz.todayQuizProvider);
  ref.invalidate(quiz.wordLearningQuizProvider);
  ref.invalidate(quiz.wordReviewQuizProvider);
  ref.invalidate(quiz.sentenceTypingQuizProvider);
  ref.invalidate(quiz.sentenceArrangeQuizProvider);
  ref.invalidate(quiz.quizProgressProvider);

  // 홈 위젯에 박힌 이전 언어 콘텐츠도 비움 — 잠금화면/홈에 영문 문장이
  // 잔존하지 않게. 다음 today 응답이 새 언어로 push.
  HomeWidgetService.clear();
}
