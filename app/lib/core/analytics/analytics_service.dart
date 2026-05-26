import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Thin wrapper over [FirebaseAnalytics] so call sites never touch
/// the plugin's surface directly. Centralising:
///   - The event-name dictionary (typoed strings ruin every dashboard
///     I've ever maintained).
///   - The parameter shape per event, so analytics consumers (Firebase
///     console, BigQuery, GA4 explorations) see consistent keys.
///   - One safe-call wrapper that swallows initialization errors —
///     analytics is best-effort, it must never break the app.
///
/// When Firebase isn't configured for the running build (e.g. the
/// Firebase project doesn't have Analytics enabled yet), all calls
/// no-op silently. The Console-side enablement step is what actually
/// turns the lights on; the client code stays unchanged.
class AnalyticsService {
  final FirebaseAnalytics _fa;

  AnalyticsService(this._fa);

  FirebaseAnalytics get firebase => _fa;

  // ── lifecycle ──────────────────────────────────────────────────

  Future<void> setUserId(String? id) => _safe(
        () => _fa.setUserId(id: id),
      );

  /// Per-user dimension: 'free' | 'premium'. Drives every "premium
  /// users vs everyone else" segmentation in GA4.
  Future<void> setSubscriptionTier(String tier) => _safe(
        () => _fa.setUserProperty(name: 'subscription_tier', value: tier),
      );

  /// Learning track selected during onboarding (beginner / intermediate
  /// / advanced / toeic / toefl / conversation).
  Future<void> setLearningTrack(String? track) => _safe(
        () => _fa.setUserProperty(name: 'learning_track', value: track),
      );

  // ── auth ───────────────────────────────────────────────────────

  Future<void> logLogin(String method) => _safe(
        () => _fa.logLogin(loginMethod: method),
      );

  Future<void> logSignUp(String method) => _safe(
        () => _fa.logSignUp(signUpMethod: method),
      );

  Future<void> logLogout() => _log('logout');

  Future<void> logAccountDeleted() => _log('account_deleted');

  // ── subscription ───────────────────────────────────────────────

  /// Fired whenever the user lands on /subscription. `source` tells us
  /// which entry point (banner / quiz paywall / settings) is doing the
  /// upsell — most important number for the funnel.
  Future<void> logSubscriptionUpsellOpened(String source) => _log(
        'subscription_upsell_opened',
        {'source': source},
      );

  Future<void> logPurchaseInitiated(String productId) => _log(
        'purchase_initiated',
        {'product_id': productId},
      );

  Future<void> logPurchaseCompleted(String productId) => _log(
        'purchase_completed',
        {'product_id': productId},
      );

  Future<void> logPurchaseFailed(String reason) => _log(
        'purchase_failed',
        {'reason': reason},
      );

  // ── quiz ───────────────────────────────────────────────────────

  /// `quizType` = fill_blank | word_order | translation |
  /// multiple_choice. `source` = daily | review | words | listening |
  /// sentenceListening.
  Future<void> logQuizSubmitted({
    required String quizType,
    required String source,
    required bool isCorrect,
  }) =>
      _log('quiz_submitted', {
        'quiz_type': quizType,
        'quiz_source': source,
        'is_correct': isCorrect ? 1 : 0,
      });

  // ── content engagement ────────────────────────────────────────

  Future<void> logPronunciationPlayed({required String kind}) => _log(
        'pronunciation_played',
        {'kind': kind /* sentence | word */},
      );

  Future<void> logSentenceCompleted(int sentenceId) => _log(
        'sentence_completed',
        {'sentence_id': sentenceId},
      );

  Future<void> logWordBookmarked(String word) => _log(
        'word_bookmarked',
        // Avoid sending full user input as a parameter value (PII risk
        // + 100-char limit). Length is a safe proxy.
        {'word_length': word.length},
      );

  // ── internals ──────────────────────────────────────────────────

  Future<void> _log(String name, [Map<String, Object?>? params]) {
    return _safe(() => _fa.logEvent(name: name, parameters: _clean(params)));
  }

  /// GA4 rejects null parameter values — drop them.
  Map<String, Object>? _clean(Map<String, Object?>? params) {
    if (params == null) return null;
    final out = <String, Object>{};
    for (final e in params.entries) {
      final v = e.value;
      if (v != null) out[e.key] = v;
    }
    return out.isEmpty ? null : out;
  }

  Future<void> _safe(Future<void> Function() op) async {
    try {
      await op();
    } catch (_) {
      // Analytics must never block the user. Swallow.
    }
  }
}

final analyticsServiceProvider = Provider<AnalyticsService>((ref) {
  return AnalyticsService(FirebaseAnalytics.instance);
});

/// Observer hooked into GoRouter to fire `screen_view` automatically
/// on every route transition. GA4 picks these up natively (no manual
/// `logScreenView` calls needed for the basic tab/page transitions).
final analyticsObserverProvider = Provider<FirebaseAnalyticsObserver>((ref) {
  return FirebaseAnalyticsObserver(
    analytics: ref.read(analyticsServiceProvider).firebase,
  );
});
