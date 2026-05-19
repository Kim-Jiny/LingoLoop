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

  Future<void> login({required String email, required String password}) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(authRepositoryProvider);
      final auth = await repo.login(email: email, password: password);
      return auth.user;
    });
  }

  Future<void> register({
    required String email,
    required String password,
    String? nickname,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(authRepositoryProvider);
      final auth = await repo.register(
        email: email,
        password: password,
        nickname: nickname,
      );
      return auth.user;
    });
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

  Future<void> refreshCurrentUser() async {
    final repo = ref.read(authRepositoryProvider);
    state = await AsyncValue.guard(() => repo.getCurrentUser());
  }

  Future<void> updateProfile({
    String? nickname,
    String? targetLanguage,
    String? nativeLanguage,
  }) async {
    final repo = ref.read(authRepositoryProvider);
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => repo.updateProfile(
        nickname: nickname,
        targetLanguage: targetLanguage,
        nativeLanguage: nativeLanguage,
      ),
    );
  }
}
