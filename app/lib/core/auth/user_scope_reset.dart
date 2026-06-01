import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../widget/home_widget_service.dart';
import '../../features/notification/presentation/notification_settings_screen.dart';
import '../../features/progress/domain/progress_provider.dart';
import '../../features/quiz/domain/quiz_provider.dart' as quiz;
import '../../features/review/domain/review_provider.dart' as review;
import '../../features/sentence/domain/sentence_provider.dart';
import '../../features/subscription/domain/subscription_provider.dart';
import '../../features/support/presentation/inquiry_list_screen.dart';
import '../../features/vocabulary/domain/vocabulary_provider.dart';

/// 사용자 단위로 캐시되는 모든 FutureProvider를 일괄 invalidate.
///
/// 호출 시점: logout / login / register / socialLogin / deleteAccount —
/// auth state가 다른 user(또는 null)로 바뀌는 모든 경계.
///
/// Riverpod의 FutureProvider는 invalidate 호출 전까지 in-memory 캐시를
/// 들고 있어, A 계정에서 받은 todaySentence/구독상태/단어장 등이 B 계정
/// 로그인 후에도 보임. 더 심한 부작용은 캐시된 A의 assignmentId로 B가
/// /complete /skip을 호출해 서버 403 — 사용자 입장에선 "넘기기/완료가 다
/// 실패함".
///
/// 홈 위젯도 클리어 — OS 레벨에 박힌 A의 문장/단어장이 잠금화면에 남는
/// 걸 막음.
void resetUserScopedState(Ref ref) {
  // Sentence / vocabulary / review hub
  ref.invalidate(todaySentenceProvider);
  ref.invalidate(vocabularyListProvider);
  ref.invalidate(review.reviewQueueProvider);

  // Subscription
  ref.invalidate(subscriptionStatusProvider);
  ref.invalidate(purchaseCatalogProvider);

  // Progress / stats
  ref.invalidate(learningStatsProvider);
  ref.invalidate(achievementsProvider);
  ref.invalidate(weeklyReportProvider);
  ref.invalidate(heatmapProvider);
  ref.invalidate(sentenceProgressProvider);

  // Quiz (모든 일일/카테고리별 캐시)
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

  // Notification + 문의
  // (identitiesProvider는 ref.watch(authStateProvider) 자동 invalidate)
  ref.invalidate(notificationSettingsProvider);
  ref.invalidate(myInquiriesProvider);

  // 홈 위젯 데이터까지 비움 (잠금화면/홈에 남은 이전 사용자 문장 제거).
  // fire-and-forget — async이지만 결과를 기다릴 필요 없음.
  HomeWidgetService.clear();
}
