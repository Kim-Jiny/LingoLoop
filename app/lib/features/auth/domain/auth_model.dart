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
  final String? learningTrack;
  final int dailyGoal;

  UserInfo({
    required this.id,
    required this.email,
    this.nickname,
    required this.targetLanguage,
    required this.nativeLanguage,
    required this.subscriptionTier,
    this.learningTrack,
    this.dailyGoal = 3,
  });

  factory UserInfo.fromJson(Map<String, dynamic> json) {
    return UserInfo(
      id: json['id'],
      email: json['email'],
      nickname: json['nickname'],
      targetLanguage: json['targetLanguage'] ?? 'en',
      nativeLanguage: json['nativeLanguage'] ?? 'ko',
      subscriptionTier: json['subscriptionTier'] ?? 'free',
      learningTrack: json['learningTrack'],
      dailyGoal: json['dailyGoal'] ?? 3,
    );
  }

  bool get isPremium => subscriptionTier == 'premium';
}

class LinkedIdentity {
  final String provider;
  final String? email;
  final String? linkedAt;

  LinkedIdentity({required this.provider, this.email, this.linkedAt});

  factory LinkedIdentity.fromJson(Map<String, dynamic> json) {
    return LinkedIdentity(
      provider: json['provider'] ?? '',
      email: json['email'],
      linkedAt: json['linkedAt']?.toString(),
    );
  }
}

class IdentitiesInfo {
  final bool hasPassword;
  final List<LinkedIdentity> identities;

  IdentitiesInfo({required this.hasPassword, required this.identities});

  factory IdentitiesInfo.fromJson(Map<String, dynamic> json) {
    return IdentitiesInfo(
      hasPassword: json['hasPassword'] ?? false,
      identities: (json['identities'] as List? ?? [])
          .map((e) => LinkedIdentity.fromJson(e))
          .toList(),
    );
  }

  bool has(String provider) =>
      identities.any((i) => i.provider == provider);
}
