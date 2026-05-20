import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:kakao_flutter_sdk_user/kakao_flutter_sdk_user.dart';
import '../../../core/constants/app_constants.dart';

enum SocialProvider { google, apple, kakao }

class SocialToken {
  final SocialProvider provider;
  final String token;

  /// Apple-only one-shot code. The server exchanges it for a
  /// refresh_token so it can revoke the user's Apple session at
  /// account-deletion time. Null for non-Apple providers.
  final String? authorizationCode;

  const SocialToken(this.provider, this.token, {this.authorizationCode});

  String get providerName => provider.name;
}

final socialAuthServiceProvider = Provider<SocialAuthService>(
  (ref) => SocialAuthService(),
);

/// Obtains a verifiable token from each social provider's native SDK.
/// Returns null when the user cancels. Requires the provider consoles to be
/// configured (Google OAuth client, Apple capability, Kakao native key);
/// until then these throw at runtime and the caller surfaces the error.
class SocialAuthService {
  Future<SocialToken?> signIn(SocialProvider provider) {
    switch (provider) {
      case SocialProvider.google:
        return _google();
      case SocialProvider.apple:
        return _apple();
      case SocialProvider.kakao:
        return _kakao();
    }
  }

  Future<SocialToken?> _google() async {
    final gsi = GoogleSignIn(
      scopes: const ['email'],
      serverClientId: AppConstants.googleServerClientId.isEmpty
          ? null
          : AppConstants.googleServerClientId,
    );
    final account = await gsi.signIn();
    if (account == null) return null;
    final auth = await account.authentication;
    final idToken = auth.idToken;
    if (idToken == null) return null;
    return SocialToken(SocialProvider.google, idToken);
  }

  Future<SocialToken?> _apple() async {
    final cred = await SignInWithApple.getAppleIDCredential(
      scopes: [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
    );
    final token = cred.identityToken;
    if (token == null) return null;
    return SocialToken(
      SocialProvider.apple,
      token,
      authorizationCode: cred.authorizationCode,
    );
  }

  Future<SocialToken?> _kakao() async {
    OAuthToken token;
    if (await isKakaoTalkInstalled()) {
      try {
        token = await UserApi.instance.loginWithKakaoTalk();
      } catch (_) {
        token = await UserApi.instance.loginWithKakaoAccount();
      }
    } else {
      token = await UserApi.instance.loginWithKakaoAccount();
    }
    return SocialToken(SocialProvider.kakao, token.accessToken);
  }
}
