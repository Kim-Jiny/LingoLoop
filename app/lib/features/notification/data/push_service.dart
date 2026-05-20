import 'dart:io';
import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/router/app_router.dart';
import '../../../core/widget/home_widget_service.dart';
import 'notification_repository.dart';

final pushServiceProvider = Provider<PushService>((ref) {
  return PushService(ref.read(notificationRepositoryProvider), ref);
});

class PushService {
  final NotificationRepository _repo;
  final Ref _ref;
  bool _initialized = false;

  PushService(this._repo, this._ref);

  // Resolve lazily: the GoRouter instance is rebuilt on auth/onboarding
  // changes, so a captured reference would point at a dead navigator.
  GoRouter get _router => _ref.read(routerProvider);

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    try {
      // Accessed lazily: FirebaseMessaging.instance throws if Firebase
      // failed to initialize (e.g. missing platform config). Keeping it
      // out of the constructor stops that from breaking the provider.
      final messaging = FirebaseMessaging.instance;

      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        return;
      }

      final token = await messaging.getToken();
      if (token != null) {
        final platform = Platform.isIOS ? 'ios' : 'android';
        await _repo.registerToken(token, platform);
      }

      messaging.onTokenRefresh.listen((newToken) async {
        final platform = Platform.isIOS ? 'ios' : 'android';
        await _repo.registerToken(newToken, platform);
      });

      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
      FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageTap);

      final initialMessage = await messaging.getInitialMessage();
      if (initialMessage != null) {
        _handleMessageTap(initialMessage);
      }
    } catch (_) {
      // FCM is intentionally allowed to be absent during early development.
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    // Silent widget-refresh pushes from the midnight cron must not show
    // any UI; they just update the App Group so the home widget redraws.
    if (message.data['type'] == 'widget_refresh') {
      final d = message.data;
      HomeWidgetService.updateTodaySentence(
        text: d['today_text'] ?? '',
        translation: d['today_translation'] ?? '',
        assignedDate: d['today_date'] ?? '',
        pronunciation: d['today_pronunciation'],
        situation: d['today_situation'],
      );
      return;
    }

    final context = _router.routerDelegate.navigatorKey.currentContext;
    final messenger = context == null
        ? null
        : ScaffoldMessenger.maybeOf(context);
    messenger?.showSnackBar(
      SnackBar(
        content: Text(
          message.notification?.body ??
              message.data['body'] ??
              '새 학습 알림이 도착했어요.',
        ),
        action: SnackBarAction(
          label: '열기',
          onPressed: () => _handleMessageTap(message),
        ),
      ),
    );
  }

  void _handleMessageTap(RemoteMessage message) {
    final data = message.data;
    final action = data['action'];

    switch (action) {
      case 'quiz':
        if (!AppConstants.premiumEnabled) {
          // Quiz is not shipped yet in the free-only release.
          _router.go('/');
          break;
        }
        // Land on home (keeps bottom nav as a back target) then open quiz,
        // since /quiz is a top-level route without the tab shell.
        _router.go('/');
        _router.push('/quiz');
        break;
      case 'today':
        _router.go('/');
        break;
      case 'history':
        _router.go('/');
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
