import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/router/app_router.dart';
import 'notification_repository.dart';

final pushServiceProvider = Provider<PushService>((ref) {
  return PushService(
    ref.read(notificationRepositoryProvider),
    ref.read(routerProvider),
  );
});

class PushService {
  final NotificationRepository _repo;
  final GoRouter _router;
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  PushService(this._repo, this._router);

  Future<void> initialize() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      return;
    }

    // Get FCM token
    final token = await _messaging.getToken();
    if (token != null) {
      final platform = Platform.isIOS ? 'ios' : 'android';
      await _repo.registerToken(token, platform);
    }

    // Listen for token refresh
    _messaging.onTokenRefresh.listen((newToken) async {
      final platform = Platform.isIOS ? 'ios' : 'android';
      await _repo.registerToken(newToken, platform);
    });

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Handle background/terminated tap
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageTap);

    // Check if app opened from terminated state via push
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleMessageTap(initialMessage);
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    // Foreground messages handled by UI overlay — no navigation needed
  }

  void _handleMessageTap(RemoteMessage message) {
    final data = message.data;
    final action = data['action'];

    switch (action) {
      case 'quiz':
        _router.push('/quiz');
        break;
      case 'today':
        _router.go('/');
        break;
      case 'history':
        _router.push('/history');
        break;
      default:
        _router.go('/');
    }

    // Mark push as tapped
    final pushLogId = data['pushLogId'];
    if (pushLogId != null) {
      _repo.markPushTapped(pushLogId);
    }
  }
}
