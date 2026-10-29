import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lingoloop/core/version/store_version_service.dart';
import 'package:lingoloop/core/version/version_gate.dart';
import 'package:lingoloop/features/auth/domain/auth_model.dart';
import 'package:lingoloop/features/auth/domain/auth_provider.dart';
import 'package:lingoloop/features/settings/presentation/settings_screen.dart';
import 'package:lingoloop/features/subscription/data/subscription_repository.dart';
import 'package:lingoloop/features/subscription/domain/subscription_status_provider.dart';
import 'package:lingoloop/features/support/data/inquiry_repository.dart';
import 'package:lingoloop/features/support/presentation/inquiry_list_screen.dart';
import 'package:package_info_plus/package_info_plus.dart';

class _FakeAuth extends AuthNotifier {
  @override
  Future<UserInfo?> build() async => UserInfo(
    id: 'u1',
    email: 'a@b.c',
    nickname: '링고',
    targetLanguage: 'ja',
    nativeLanguage: 'ko',
    subscriptionTier: 'free',
    dailyGoal: 5,
  );
}

void main() {
  testWidgets('설정 화면이 예외 없이 그려진다', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authStateProvider.overrideWith(_FakeAuth.new),
          identitiesProvider.overrideWith(
            (ref) async =>
                IdentitiesInfo(hasPassword: true, identities: const []),
          ),
          subscriptionStatusProvider.overrideWith(
            (ref) async => SubscriptionStatus.fromJson({}),
          ),
          myInquiriesProvider.overrideWith(
            (ref) async => const InquiryListResponse(items: [], unreadCount: 0),
          ),
          packageInfoProvider.overrideWith(
            (ref) async => PackageInfo(
              appName: 'LingoLoop',
              packageName: 'x.y',
              version: '1.3.0',
              buildNumber: '1',
            ),
          ),
          storeVersionProvider.overrideWith((ref) async => null),
        ],
        child: const MaterialApp(home: SettingsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('링고'), findsOneWidget);
    expect(find.text('하루 5문장'), findsWidgets);

    await tester.pumpWidget(const SizedBox());
    await tester.pumpAndSettle();
  });
}
