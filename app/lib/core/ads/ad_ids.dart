import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kReleaseMode;

/// AdMob 광고 단위 ID 일괄 관리.
///
/// release 빌드만 production unit ID를 쓰고, debug/profile은 Google이
/// 공식 제공하는 test ID로 자동 전환. 실수로 디버깅 트래픽이 실수익에
/// 섞이는 걸 막고, 정책 위반(self-click) 위험도 차단.
///
/// AdMob 콘솔에서 신규 단위를 추가하면 release 매핑만 갱신.
class AdIds {
  AdIds._();

  // ── Test IDs (Google 공식 — 무한 채워짐, 정책 안전) ──────────────────
  static const _testBannerIos = 'ca-app-pub-3940256099942544/2934735716';
  static const _testBannerAndroid = 'ca-app-pub-3940256099942544/6300978111';

  // ── App IDs (Info.plist / AndroidManifest에 들어가는 ID) ────────────
  /// iOS GADApplicationIdentifier. Info.plist에 직접 세팅 — 여기 값은
  /// 단순 참조용. 변경 시 plist도 같이 수정해야 함.
  static const iosAppId = 'ca-app-pub-2707874353926722~6550444550';
  /// Android com.google.android.gms.ads.APPLICATION_ID. Manifest에 직접
  /// 세팅 — 같은 caveat.
  static const androidAppId = 'ca-app-pub-2707874353926722~1301987304';

  // ── Banner unit IDs per tab ─────────────────────────────────────────
  // 메인(오늘) / 복습 / 기록 / 설정 4탭에 배너 배치.

  static String tabBanner(AdTab tab) {
    if (!kReleaseMode) {
      // Debug/profile은 항상 test 단위.
      return Platform.isIOS ? _testBannerIos : _testBannerAndroid;
    }
    if (Platform.isIOS) {
      switch (tab) {
        case AdTab.today:
          return 'ca-app-pub-2707874353926722/9180477324';
        case AdTab.review:
          return 'ca-app-pub-2707874353926722/7188434885';
        case AdTab.progress:
          return 'ca-app-pub-2707874353926722/3928150642';
        case AdTab.settings:
          return 'ca-app-pub-2707874353926722/2315686071';
      }
    }
    // Android
    switch (tab) {
      case AdTab.today:
        return 'ca-app-pub-2707874353926722/6362742293';
      case AdTab.review:
        return 'ca-app-pub-2707874353926722/9623026533';
      case AdTab.progress:
        return 'ca-app-pub-2707874353926722/5982330277';
      case AdTab.settings:
        return 'ca-app-pub-2707874353926722/7473021280';
    }
  }
}

enum AdTab { today, review, progress, settings }
