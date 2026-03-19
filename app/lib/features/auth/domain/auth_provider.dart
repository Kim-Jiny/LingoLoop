import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/auth_repository.dart';
import 'auth_model.dart';

// Tracks current auth state (null = logged out)
final authStateProvider =
    AsyncNotifierProvider<AuthNotifier, UserInfo?>(() => AuthNotifier());

class AuthNotifier extends AsyncNotifier<UserInfo?> {
  @override
  Future<UserInfo?> build() async {
    final repo = ref.read(authRepositoryProvider);
    return repo.getCurrentUser();
  }

  Future<void> login({
    required String email,
    required String password,
  }) async {
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
          email: email, password: password, nickname: nickname);
      return auth.user;
    });
  }

  Future<void> logout() async {
    final repo = ref.read(authRepositoryProvider);
    await repo.logout();
    state = const AsyncData(null);
  }
}
