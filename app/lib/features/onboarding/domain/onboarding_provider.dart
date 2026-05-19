import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const onboardingSeenKey = 'onboarding_seen';

class OnboardingNotifier extends Notifier<bool> {
  OnboardingNotifier([this._initial = false]);

  final bool _initial;

  @override
  bool build() => _initial;

  void markSeen() => state = true;
}

/// Whether the user has completed the first-run onboarding.
///
/// The real initial value is injected in `main()` via an override after
/// reading [SharedPreferences], so the router never flickers through the
/// onboarding screen for returning users.
final onboardingSeenProvider =
    NotifierProvider<OnboardingNotifier, bool>(OnboardingNotifier.new);

Future<void> completeOnboarding(WidgetRef ref) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setBool(onboardingSeenKey, true);
  ref.read(onboardingSeenProvider.notifier).markSeen();
}
