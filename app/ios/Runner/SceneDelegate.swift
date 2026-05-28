import Flutter
import UIKit
import UserNotifications

class SceneDelegate: FlutterSceneDelegate {
  /// 앱이 active 상태로 들어올 때마다 뱃지 0으로 reset.
  /// - cold launch 직후
  /// - background → foreground 복귀
  /// - 시스템 alert / 컨트롤 센터 닫고 돌아올 때
  ///
  /// Dart MethodChannel은 cold launch 시 implicit Flutter engine
  /// attach 전이라 race 발생. native lifecycle hook이 가장 확실한
  /// 시점이라 여기서 직접 처리. 두 API 모두 호출하는 이유는
  /// iOS 16+ setBadgeCount(0)이 가끔 icon update를 안 하는
  /// Apple known issue 회피.
  override func sceneDidBecomeActive(_ scene: UIScene) {
    super.sceneDidBecomeActive(scene)
    DispatchQueue.main.async {
      UIApplication.shared.applicationIconBadgeNumber = 0
    }
    if #available(iOS 16.0, *) {
      UNUserNotificationCenter.current().setBadgeCount(0) { _ in }
    }
  }
}
