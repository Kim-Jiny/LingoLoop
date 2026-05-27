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

  /// FCM 알림 정리용 MethodChannel. Android의 MainActivity.kt와 같은
  /// channel name. Dart 측에서 Platform.isAndroid/isIOS 분기로 호출.
  private func setupNotificationChannel() {
    guard let controller = window?.rootViewController as? FlutterViewController else {
      // implicit engine이 아직 view controller를 attach하지 않은 시점
      // 가능 — UIWindowDidBecomeKey 한 번 받고 재시도.
      NotificationCenter.default.addObserver(
        forName: UIWindow.didBecomeKeyNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.setupNotificationChannel()
      }
      return
    }
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
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }
}
