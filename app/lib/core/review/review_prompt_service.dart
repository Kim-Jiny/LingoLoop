import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_review/in_app_review.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 스토어 인앱 리뷰 팝업을 적절한 순간에 호출.
///
/// iOS: SKStoreReviewController, Android: Play In-App Review API.
/// 둘 다 OS가 연간 호출 quota를 강제로 throttle해서 스팸은 구조적
/// 으로 불가. 그래도 OS가 실제로 띄울 가능성을 높이려면 "사용자가
/// 만족스러운 순간"에 호출하는 게 중요.
///
/// 트리거:
///   - 퀴즈 누적 [_quizCountThreshold]회 완료 후 매 quiz 완료
///   - 오늘 문장 연속 [_streakThreshold]일 달성 후 매 문장 완료
///
/// 추가 throttle:
///   - 마지막 prompt로부터 [_cooldownDays]일 이상 경과
///   - 설치 후 [_minDaysAfterInstall]일 이상 경과
///
/// 설치 시각은 SharedPreferences에 lazy 기록 — 첫 prompt 시도 시
/// 처음 적힘. 그 첫 시도는 install age 0이라 자동으로 reject돼
/// 다음 적격 순간까지 buffer 역할.
class ReviewPromptService {
  static const _kInstallDateKey = 'review_install_date';
  static const _kLastPromptKey = 'review_last_prompt_date';
  static const _kQuizCountKey = 'review_quiz_complete_count';

  static const _quizCountThreshold = 10;
  static const _streakThreshold = 5;
  static const _cooldownDays = 30;
  static const _minDaysAfterInstall = 2;

  final InAppReview _api = InAppReview.instance;

  /// 정상적으로 마지막 문제까지 다 푼 퀴즈 완료 후 호출. finishEarly
  /// 같은 도중 종료에서는 부르지 않음 — 만족도 보장 못 함.
  Future<void> maybePromptAfterQuiz() async {
    final prefs = await SharedPreferences.getInstance();
    await _bumpQuizCount(prefs);
    final count = prefs.getInt(_kQuizCountKey) ?? 0;
    if (count < _quizCountThreshold) return;
    if (!await _canPrompt(prefs)) return;
    await _prompt(prefs);
  }

  /// 오늘 문장 완료 직후 — 최신 streak 값을 받아 호출. 임계값 이상
  /// 일 때만 prompt 후보. 30일 쿨다운으로 반복 차단.
  Future<void> maybePromptAfterStreak(int streak) async {
    if (streak < _streakThreshold) return;
    final prefs = await SharedPreferences.getInstance();
    if (!await _canPrompt(prefs)) return;
    await _prompt(prefs);
  }

  Future<void> _prompt(SharedPreferences prefs) async {
    try {
      if (!await _api.isAvailable()) return;
      await _api.requestReview();
    } catch (_) {
      // 패키지/OS 레벨 에러는 silent — 리뷰 prompt 실패가 학습 흐름을
      // 방해해선 안 됨.
    }
    // OS가 실제로 띄웠는지와 무관하게 cooldown은 시작. API를 너무 자주
    // 호출하지 않기 위함.
    await prefs.setString(
      _kLastPromptKey,
      DateTime.now().toIso8601String(),
    );
  }

  Future<bool> _canPrompt(SharedPreferences prefs) async {
    final now = DateTime.now();
    final installRaw = prefs.getString(_kInstallDateKey);
    if (installRaw == null) {
      // 첫 등장 — 설치 시각 기록만 하고 이번 호출은 skip.
      await prefs.setString(_kInstallDateKey, now.toIso8601String());
      return false;
    }
    final installed = DateTime.tryParse(installRaw) ?? now;
    if (now.difference(installed).inDays < _minDaysAfterInstall) return false;
    final lastRaw = prefs.getString(_kLastPromptKey);
    if (lastRaw != null) {
      final last = DateTime.tryParse(lastRaw);
      if (last != null &&
          now.difference(last).inDays < _cooldownDays) {
        return false;
      }
    }
    return true;
  }

  Future<void> _bumpQuizCount(SharedPreferences prefs) async {
    final current = prefs.getInt(_kQuizCountKey) ?? 0;
    await prefs.setInt(_kQuizCountKey, current + 1);
  }
}

final reviewPromptServiceProvider = Provider<ReviewPromptService>((ref) {
  return ReviewPromptService();
});
