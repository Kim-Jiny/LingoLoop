import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Version-driven feature gates. Lets us ship a build with the
/// premium UI visible but the actual store IAP wiring still
/// dormant — when the next minor version (1.1.0) goes live, the
/// gate flips automatically because the running app reports a
/// higher version. No second app-store submission needed to flip a
/// remote flag.
class VersionGate {
  VersionGate._();

  /// `true` once the build version is at or past the threshold that
  /// has real IAP products configured on App Store Connect / Play.
  ///
  /// 1.0.0.x → false (preview-locked: premium UI is visible but
  /// `buyPremium` / `restorePurchases` are blocked behind a
  /// "곧 출시 예정" notice).
  /// 1.1.0+   → true (real purchase flow active).
  static bool iapUnlocked(String version) {
    final parts = version
        .split('+') // strip the build number ("1.0.0+2" → "1.0.0")
        .first
        .split('.')
        .map((s) => int.tryParse(s) ?? 0)
        .toList();
    while (parts.length < 3) {
      parts.add(0);
    }
    final major = parts[0];
    final minor = parts[1];
    // Anything ≥ 1.1.0 is unlocked. Below that, IAP is preview-locked.
    return major > 1 || (major == 1 && minor >= 1);
  }
}

/// Cached app version + build number from the platform side.
/// Loaded once at first read; the values don't change while the
/// process is alive.
final packageInfoProvider = FutureProvider<PackageInfo>((ref) {
  return PackageInfo.fromPlatform();
});

/// `true` when the app's version is ≥ 1.1.0. Drives every
/// purchase-related CTA — `buyPremium`, `restorePurchases`, the
/// quiz paywall's "구독하기" button — to fall back to a lock notice
/// while still letting the user preview the premium UI.
///
/// While loading, the provider treats the app as locked so we don't
/// briefly flash a real purchase button before falling back.
final iapUnlockedProvider = Provider<bool>((ref) {
  return ref.watch(packageInfoProvider).maybeWhen(
        data: (info) => VersionGate.iapUnlocked(info.version),
        orElse: () => false,
      );
});
