class AuthResponse {
  final String accessToken;
  final String refreshToken;
  final UserInfo user;

  AuthResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      accessToken: json['accessToken'],
      refreshToken: json['refreshToken'],
      user: UserInfo.fromJson(json['user']),
    );
  }
}

class UserInfo {
  final String id;
  final String email;
  final String? nickname;
  final String targetLanguage;
  final String nativeLanguage;
  final String subscriptionTier;

  UserInfo({
    required this.id,
    required this.email,
    this.nickname,
    required this.targetLanguage,
    required this.nativeLanguage,
    required this.subscriptionTier,
  });

  factory UserInfo.fromJson(Map<String, dynamic> json) {
    return UserInfo(
      id: json['id'],
      email: json['email'],
      nickname: json['nickname'],
      targetLanguage: json['targetLanguage'] ?? 'en',
      nativeLanguage: json['nativeLanguage'] ?? 'ko',
      subscriptionTier: json['subscriptionTier'] ?? 'free',
    );
  }

  bool get isPremium => subscriptionTier == 'premium';
}
