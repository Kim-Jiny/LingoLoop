import 'dart:io' show Platform;
import 'package:app_tracking_transparency/app_tracking_transparency.dart';

/// iOS 14+ App Tracking Transparency 헬퍼.
///
/// AdMob personalized ads(IDFA 활용)를 위해 한 번 권한 다이얼로그를
/// 띄움. 거부해도 비-개인화 광고는 정상 노출되므로 매출에 치명적
/// 영향은 없지만, eCPM 차이가 있음.
///
/// Android는 ATT 개념 자체가 없음 — no-op으로 즉시 종료.
class AttService {
  AttService._();

  /// 한 번만 권한 다이얼로그를 띄우는 it idempotent 호출. 이미 결정한
  /// 사용자(허용/거부/제한)는 시스템 캐시 결과만 반환. iOS 14 미만은
  /// notSupported 반환.
  ///
  /// onboarding 마지막 단계 또는 첫 home 진입 후 1~2초 delay 권장 —
  /// 앱 첫 launch 즉시 띄우면 Apple 가이드라인 위반(사전 컨텍스트 없이
  /// 권한 요청). 우리는 onboarding의 "알림 켜고 시작" 옆에 자연스럽게.
  static Future<TrackingStatus> requestIfNeeded() async {
    if (!Platform.isIOS) return TrackingStatus.notSupported;
    try {
      final current =
          await AppTrackingTransparency.trackingAuthorizationStatus;
      if (current == TrackingStatus.notDetermined) {
        return AppTrackingTransparency.requestTrackingAuthorization();
      }
      return current;
    } catch (_) {
      return TrackingStatus.notSupported;
    }
  }
}
