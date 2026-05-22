import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/error_message.dart';
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
    return repo.getCurrentUser();
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
      state = AsyncData(auth.user);
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
      state = AsyncData(auth.user);
      return null;
    } catch (e) {
      state = const AsyncData(null);
      return friendlyErrorMessage(
        e,
        fallback: '회원가입에 실패했어요. 입력 정보를 확인해주세요.',
      );
    }
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
      state = AsyncData(auth.user);
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
    state = const AsyncData(null);
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
      state = const AsyncData(null);
      return null;
    } catch (e) {
      return friendlyErrorMessage(e, fallback: '회원 탈퇴에 실패했어요.');
    }
  }

  Future<void> refreshCurrentUser() async {
    final repo = ref.read(authRepositoryProvider);
    state = await AsyncValue.guard(() => repo.getCurrentUser());
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
    try {
      final updated = await repo.updateProfile(
        nickname: nickname,
        targetLanguage: targetLanguage,
        nativeLanguage: nativeLanguage,
        learningTrack: learningTrack,
        dailyGoal: dailyGoal,
      );
      state = AsyncData(updated);
      return null;
    } catch (e) {
      return friendlyErrorMessage(e, fallback: '프로필 변경에 실패했어요.');
    }
  }
}
