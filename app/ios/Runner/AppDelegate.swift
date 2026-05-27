import Flutter
import UIKit
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private let notificationChannelName = "com.jiny.lingoloop/notifications"

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let launched = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    setupNotificationChannel()
    return launched
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }

  /// 한 번만 setup하도록 가드 — UIWindowDidBecomeKey가 첫 setup 후
  /// 다시 fire되어도 새 MethodChannel 안 만듦 (handler 누적/observer 누수
  /// 방지). channel 객체는 deinit 없이 AppDelegate 생명주기와 함께 유지.
  private var notificationChannelReady = false
  private var pendingChannelObserver: NSObjectProtocol?

  /// FCM 알림 정리용 MethodChannel. Android의 MainActivity.kt와 같은
  /// channel name. Dart 측에서 Platform.isAndroid/isIOS 분기로 호출.
  private func setupNotificationChannel() {
    if notificationChannelReady { return }
    guard let controller = window?.rootViewController as? FlutterViewController else {
      // implicit engine이 아직 view controller를 attach하지 않은 시점
      // 가능 — UIWindowDidBecomeKey 한 번 받고 재시도. 이미 observer가
      // 등록돼 있으면 중복 등록 안 함.
      if pendingChannelObserver == nil {
        pendingChannelObserver = NotificationCenter.default.addObserver(
          forName: UIWindow.didBecomeKeyNotification,
          object: nil,
          queue: .main
        ) { [weak self] _ in
          self?.setupNotificationChannel()
        }
      }
      return
    }
    // 성공 시점에 observer 제거.
    if let token = pendingChannelObserver {
      NotificationCenter.default.removeObserver(token)
      pendingChannelObserver = nil
    }
    notificationChannelReady = true
    let channel = FlutterMethodChannel(
      name: notificationChannelName,
      binaryMessenger: controller.binaryMessenger
    )
    channel.setMethodCallHandler { (call, result) in
      switch call.method {
      // 인자: { threadId: String } — 같은 thread-id로 전달된
      // delivered notification만 알림 센터에서 제거. 다른 알림은
      // 영향 없음. inquiry_reply 처리 후 호출.
      case "removeByThreadId":
        guard let args = call.arguments as? [String: Any],
              let threadId = args["threadId"] as? String,
              !threadId.isEmpty else {
          result(FlutterError(code: "BAD_ARG", message: "threadId is required", details: nil))
          return
        }
        let center = UNUserNotificationCenter.current()
        center.getDeliveredNotifications { notifications in
          let ids = notifications
            .filter { $0.request.content.threadIdentifier == threadId }
            .map { $0.request.identifier }
          if !ids.isEmpty {
            center.removeDeliveredNotifications(withIdentifiers: ids)
          }
          DispatchQueue.main.async { result(nil) }
        }
      // 앱 아이콘 뱃지 0으로 리셋. iOS는 서버 push의 badge 필드가
      // 명시 값을 그대로 set하고 OS가 자동으로 줄이지 않아 사용자
      // 진입 시점에 명시 호출 필요. iOS 16+ setBadgeCount, 그 미만은
      // applicationIconBadgeNumber=0 fallback.
      case "clearBadge":
        if #available(iOS 16.0, *) {
          UNUserNotificationCenter.current().setBadgeCount(0) { _ in
            DispatchQueue.main.async { result(nil) }
          }
        } else {
          UIApplication.shared.applicationIconBadgeNumber = 0
          result(nil)
        }
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }
}
