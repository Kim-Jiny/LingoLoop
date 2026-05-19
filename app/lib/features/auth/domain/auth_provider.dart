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

  /// Returns false if the user cancelled the provider sheet (no error
  /// shown). Returns true otherwise; check [authStateProvider] for error.
  Future<bool> socialLogin(SocialProvider provider) async {
    final social = ref.read(socialAuthServiceProvider);
    SocialToken? token;
    try {
      token = await social.signIn(provider);
    } catch (e, st) {
      state = AsyncError(e, st);
      return true;
    }
    if (token == null) return false;
    final t = token;
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(authRepositoryProvider);
      final auth = await repo.socialLogin(
        provider: t.providerName,
        token: t.token,
      );
      return auth.user;
    });
    return true;
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
