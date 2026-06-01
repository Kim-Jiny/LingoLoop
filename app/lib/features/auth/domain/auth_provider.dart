import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/analytics/analytics_service.dart';
import '../../../core/auth/language_scope_reset.dart';
import '../../../core/auth/user_scope_reset.dart';
import '../../../core/network/error_message.dart';
import '../../sentence/domain/sentence_provider.dart';
import '../data/auth_repository.dart';
import '../data/social_auth_service.dart';
import 'auth_model.dart';

// Tracks current auth state (null = logged out)
final authStateProvider = AsyncNotifierProvider<AuthNotifier, UserInfo?>(
  () => AuthNotifier(),
);

final identitiesProvider = FutureProvider<IdentitiesInfo>((ref) async {
  ref.watch(authStateProvider);
  return ref.read(authRepositoryProvider).listIdentities();
});

class AuthNotifier extends AsyncNotifier<UserInfo?> {
  @override
  Future<UserInfo?> build() async {
    final repo = ref.read(authRepositoryProvider);
    final cached = await repo.getCurrentUser();
    // 캐시된 user로 즉시 부팅 — 네트워크 응답을 기다리지 않아 로그인
    // 화면이 깜빡이지 않음. /auth/me는 백그라운드로 fire-and-forget해
    // 서버측 변경(구독/트랙/닉네임)을 곧이어 반영.
    if (cached != null) {
      Future.microtask(() async {
        final fresh = await repo.refreshCurrentUserFromServer();
        if (fresh != null) state = AsyncData(fresh);
        // refresh가 null을 반환해도 (네트워크 오류) cached 상태 유지 —
        // 401 영구 실패는 interceptor의 onSessionExpired가 별도로 처리.
      });
    }
    return cached;
  }

  /// Returns null on success, or a user-facing error message. Mirrors
  /// the `socialLogin` pattern — we DON'T push the failure into the
  /// global `state` via AsyncValue.guard, because routerProvider
  /// watches authStateProvider and rebuilds the whole GoRouter on
  /// every state transition. That rebuild disposes the LoginScreen
  /// mid-flight, so a `if (!mounted) return; … ScaffoldMessenger.of(
  /// context).showSnackBar(...)` from the screen never fires. Returning
  /// the error string lets the screen surface it via a local setState
  /// instead, which survives the router rebuild.
  Future<String?> login({
    required String email,
    required String password,
  }) async {
    state = const AsyncLoading();
    final repo = ref.read(authRepositoryProvider);
    try {
      final auth = await repo.login(email: email, password: password);
      // 새 사용자 데이터를 들이기 전에 이전 사용자 캐시를 비움 — 같은
      // 디바이스에서 A → B 로그인 시 A의 todaySentence/구독상태/위젯이
      // 잔존해 "B로 들어왔는데 A의 문장이 보이고 skip/complete가 다 실패"
      // 하는 버그 방지.
      resetUserScopedState(ref);
      state = AsyncData(auth.user);
      _trackLogin(auth.user, method: 'email');
      return null;
    } catch (e) {
      // Restore the logged-out state explicitly. AsyncError would also
      // work, but downstream consumers (router, banner widgets) all
      // gate on `value != null` — AsyncData(null) keeps that contract
      // clean and prevents transient AsyncError flicker.
      state = const AsyncData(null);
      return friendlyErrorMessage(
        e,
        fallback: '로그인에 실패했어요. 이메일과 비밀번호를 확인해주세요.',
      );
    }
  }

  /// Same return contract as [login] — null on success, error string
  /// otherwise.
  Future<String?> register({
    required String email,
    required String password,
    String? nickname,
  }) async {
    state = const AsyncLoading();
    final repo = ref.read(authRepositoryProvider);
    try {
      final auth = await repo.register(
        email: email,
        password: password,
        nickname: nickname,
      );
      resetUserScopedState(ref);
      state = AsyncData(auth.user);
      ref.read(analyticsServiceProvider).logSignUp('email');
      _trackLogin(auth.user, method: 'email');
      return null;
    } catch (e) {
      state = const AsyncData(null);
      return friendlyErrorMessage(
        e,
        fallback: '회원가입에 실패했어요. 입력 정보를 확인해주세요.',
      );
    }
  }

  /// Reused from every auth-success branch (email login, register,
  /// social). Pushes user_id + tier + track into Analytics so GA4
  /// segments work without per-event tagging.
  void _trackLogin(UserInfo user, {required String method}) {
    final a = ref.read(analyticsServiceProvider);
    a.setUserId(user.id);
    a.setSubscriptionTier(user.subscriptionTier);
    a.setLearningTrack(user.learningTrack);
    a.logLogin(method);
  }

  /// Sign in / sign up via a social provider. Returns null on success,
  /// `'cancelled'` if the user backed out, or a user-facing error message.
  /// A failed *attempt* must not corrupt the global auth state, so the
  /// error is returned to the caller instead of pushed into [state].
  Future<String?> socialLogin(SocialProvider provider) async {
    final social = ref.read(socialAuthServiceProvider);
    SocialToken? token;
    try {
      token = await social.signIn(provider);
    } catch (e) {
      if (_isCancellation(e)) return 'cancelled';
      return friendlyErrorMessage(e, fallback: '소셜 로그인에 실패했어요.');
    }
    if (token == null) return 'cancelled';

    final t = token;
    try {
      final repo = ref.read(authRepositoryProvider);
      final auth = await repo.socialLogin(
        provider: t.providerName,
        token: t.token,
        authorizationCode: t.authorizationCode,
      );
      resetUserScopedState(ref);
      state = AsyncData(auth.user);
      _trackLogin(auth.user, method: t.providerName);
      return null;
    } catch (e) {
      return friendlyErrorMessage(e, fallback: '소셜 로그인에 실패했어요.');
    }
  }

  bool _isCancellation(Object e) {
    final s = e.toString().toLowerCase();
    return s.contains('cancel') || s.contains('12501');
  }

  /// Link a social account to the current user. Returns null on success,
  /// `'cancelled'` if the user backed out, or a user-facing error message.
  Future<String?> linkSocial(SocialProvider provider) async {
    final social = ref.read(socialAuthServiceProvider);
    final token = await social.signIn(provider);
    if (token == null) return 'cancelled';
    try {
      await ref
          .read(authRepositoryProvider)
          .linkSocial(provider: token.providerName, token: token.token);
      return null;
    } catch (e) {
      return friendlyErrorMessage(e, fallback: '연동에 실패했어요.');
    }
  }

  Future<void> logout() async {
    final repo = ref.read(authRepositoryProvider);
    await repo.logout();
    // user-scoped 캐시 + 홈 위젯 데이터 모두 비움 — 다음 로그인 사용자가
    // 깨끗한 상태에서 시작.
    resetUserScopedState(ref);
    state = const AsyncData(null);
    final a = ref.read(analyticsServiceProvider);
    a.logLogout();
    a.setUserId(null);
  }

  /// Permanently deletes the user account and locally clears the
  /// session. Returns null on success, an error message on failure.
  ///
  /// When the server refuses with `active_subscription`, the returned
  /// error message is the server-supplied explanation pointing the
  /// user to the App Store / Play Store cancel UI. Caller can show
  /// a confirmation dialog and retry with [force]=true to bypass.
  Future<String?> deleteAccount({bool force = false}) async {
    final repo = ref.read(authRepositoryProvider);
    try {
      await repo.deleteAccount(force: force);
      // Server cascaded everything; locally drop the tokens too so the
      // app doesn't try to refresh against a now-dead user id.
      await repo.logout();
      resetUserScopedState(ref);
      state = const AsyncData(null);
      final a = ref.read(analyticsServiceProvider);
      a.logAccountDeleted();
      a.setUserId(null);
      return null;
    } catch (e) {
      return friendlyErrorMessage(e, fallback: '회원 탈퇴에 실패했어요.');
    }
  }

  Future<void> refreshCurrentUser() async {
    final repo = ref.read(authRepositoryProvider);
    // 서버에서 직접 가져옴 — 명시적 refresh이므로 캐시 우선이 아니라
    // 최신값을 기다림. 실패해도 기존 state는 유지(빈 화면 회피).
    final fresh = await repo.refreshCurrentUserFromServer();
    if (fresh != null) {
      state = AsyncData(fresh);
      // Keep GA4 user properties (tier / track) in sync.
      final a = ref.read(analyticsServiceProvider);
      a.setSubscriptionTier(fresh.subscriptionTier);
      a.setLearningTrack(fresh.learningTrack);
    }
  }

  /// Returns null on success, or a user-facing error message. Does NOT
  /// flip the global auth state to loading/error — doing so makes
  /// `authState.value` momentarily null and the router bounces the
  /// logged-in user to /login mid-update.
  Future<String?> updateProfile({
    String? nickname,
    String? targetLanguage,
    String? nativeLanguage,
    String? learningTrack,
    int? dailyGoal,
  }) async {
    final repo = ref.read(authRepositoryProvider);
    final before = state.value;
    final prevTrack = before?.learningTrack;
    final prevLang = before?.targetLanguage;
    try {
      final updated = await repo.updateProfile(
        nickname: nickname,
        targetLanguage: targetLanguage,
        nativeLanguage: nativeLanguage,
        learningTrack: learningTrack,
        dailyGoal: dailyGoal,
      );
      state = AsyncData(updated);
      // 트랙이 바뀌었으면 오늘 문장도 새 트랙에서 다시 받아와야 함 —
      // 서버에서 기존 active assignment를 skipped로 정리했으므로
      // todaySentenceProvider를 invalidate하면 새 문장이 뽑힘.
      if (learningTrack != null && prevTrack != learningTrack) {
        ref.invalidate(todaySentenceProvider);
      }
      // 학습 언어가 실제로 바뀌었으면 콘텐츠/스탯/홈위젯 일괄 무효화 —
      // EN 문장이 JA로 전환한 사용자에게 잔존하지 않도록.
      if (targetLanguage != null && prevLang != targetLanguage) {
        resetLanguageScopedState(ref);
      }
      return null;
    } catch (e) {
      return friendlyErrorMessage(e, fallback: '프로필 변경에 실패했어요.');
    }
  }
}
