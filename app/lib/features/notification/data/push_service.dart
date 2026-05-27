import 'dart:convert';
import 'dart:io';
import 'package:app_settings/app_settings.dart';
import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/router/app_router.dart';
import '../../../core/widget/home_widget_service.dart';
import '../../support/presentation/inquiry_list_screen.dart';
import 'notification_repository.dart';

/// 권한 요청 결과. 호출자가 이후 UX (SnackBar / dialog) 결정에 사용.
enum PushPermissionOutcome {
  /// 사용자가 OS 다이얼로그에서 승인 (또는 이미 승인 상태).
  granted,
  /// 사용자가 OS 다이얼로그에서 거부. OS는 같은 앱에 다시 안 띄움 →
  /// 호출자가 "설정으로 이동" 안내 dialog 띄워야 함.
  denied,
  /// Firebase 미설정 등 환경 문제로 권한 요청 자체 실패. 사용자
  /// 입장에선 거부와 동일하게 처리하면 됨.
  unavailable,
}

final pushServiceProvider = Provider<PushService>((ref) {
  return PushService(ref.read(notificationRepositoryProvider), ref);
});

class PushService {
  final NotificationRepository _repo;
  final Ref _ref;
  bool _initialized = false;

  PushService(this._repo, this._ref);

  /// 로그아웃 또는 사용자 전환 시 호출. 다음 initialize()가 새 토큰
  /// 등록 (서버에서 device_token row의 userId를 새 사용자로 갈아끼움)
  /// 을 다시 수행하게 만듦. 이 reset 없이 두 번째 계정 로그인 시
  /// _initialized=true라 register 호출이 skip돼 푸시가 옛 사용자에게
  /// 계속 가는 버그가 있었음.
  void reset() {
    _initialized = false;
  }

  // Resolve lazily: the GoRouter instance is rebuilt on auth/onboarding
  // changes, so a captured reference would point at a dead navigator.
  GoRouter get _router => _ref.read(routerProvider);

  /// OS 권한 상태 조회 — 다이얼로그 안 띄우고 현재 상태만. 알림 설정
  /// 화면에서 "푸시루프 사용" 토글 켤 때 사전 확인용.
  ///
  /// Returns:
  /// - `granted`: 이미 승인 → 그냥 진행하면 됨.
  /// - `notDetermined`: OS가 아직 안 물어봄 → requestPermission이 다이얼
  ///   로그를 띄울 것.
  /// - `denied`: 이전에 거부했고 OS가 다시 안 띄움 → 호출자가 설정
  ///   안내 dialog 띄워야 함.
  Future<AuthorizationStatus> getPermissionStatus() async {
    try {
      final settings = await FirebaseMessaging.instance.getNotificationSettings();
      return settings.authorizationStatus;
    } catch (_) {
      return AuthorizationStatus.notDetermined;
    }
  }

  /// 권한 요청 + 승인 시 token 등록 + 핸들러 wire-up까지 한 번에.
  /// 이미 init된 상태면 권한만 재요청 결과 반환 (idempotent).
  ///
  /// OS 다이얼로그는 처음 호출에만 뜸. 그 뒤 호출은 cached 상태 반환
  /// (iOS: 한 번 거부하면 영영, Android 13+: deny하면 cooldown 후 다시
  /// 한 번 가능). 따라서 denied 반환받은 호출자는 설정으로 이동 dialog
  /// 띄우는 게 best.
  Future<PushPermissionOutcome> requestPermissionAndInit() async {
    try {
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );
      final status = settings.authorizationStatus;
      if (status == AuthorizationStatus.denied) {
        return PushPermissionOutcome.denied;
      }
      // notDetermined: iOS 한정 (예: 사용자가 다이얼로그 닫지 않고 앱
      // background로) — granted 대접하지 않고 그대로 둠. 다음 호출에서
      // 다시 시도.
      if (status != AuthorizationStatus.authorized &&
          status != AuthorizationStatus.provisional) {
        return PushPermissionOutcome.denied;
      }
      await _wireMessagingHandlers(messaging);
      _initialized = true;
      return PushPermissionOutcome.granted;
    } catch (_) {
      return PushPermissionOutcome.unavailable;
    }
  }

  /// OS 시스템 설정의 앱 알림 페이지로 이동. 사용자가 거부 후 다시 켜고
  /// 싶을 때 유일한 경로 (OS가 in-app 다이얼로그를 더 이상 안 띄움).
  Future<void> openSystemNotificationSettings() async {
    await AppSettings.openAppSettings(type: AppSettingsType.notification);
  }

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

      await _wireMessagingHandlers(messaging);
    } catch (_) {
      // FCM is intentionally allowed to be absent during early development.
    }
  }

  /// token register + foreground/tap handler + initialMessage 처리.
  /// initialize와 requestPermissionAndInit 양쪽에서 호출하는 공통 본체.
  Future<void> _wireMessagingHandlers(FirebaseMessaging messaging) async {
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
  }

  void _handleForegroundMessage(RemoteMessage message) {
    // Silent widget-refresh pushes from the midnight cron must not show
    // any UI; they just update the App Group so the home widget redraws.
    if (message.data['type'] == 'widget_refresh') {
      final d = message.data;
      final List<({String word, String meaning})> words = [];
      final rawWords = d['today_words'];
      if (rawWords != null && rawWords.toString().isNotEmpty) {
        try {
          final decoded = jsonDecode(rawWords.toString());
          if (decoded is List) {
            for (final item in decoded) {
              if (item is Map) {
                words.add((
                  word: (item['w'] ?? '').toString(),
                  meaning: (item['m'] ?? '').toString(),
                ));
              }
            }
          }
        } catch (_) {}
      }
      HomeWidgetService.updateTodaySentence(
        text: d['today_text'] ?? '',
        translation: d['today_translation'] ?? '',
        assignedDate: d['today_date'] ?? '',
        pronunciation: d['today_pronunciation'],
        situation: d['today_situation'],
        words: words,
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
    // 문의 답변 푸시는 `type=inquiry_reply` 데이터로 옴 — 학습 알림이
    // 쓰는 `action` 필드보다 우선 처리. 답변 도착 시 바로 내 문의
    // 화면으로 라우팅해서 사용자가 답변을 즉시 볼 수 있게 함.
    if (data['type'] == 'inquiry_reply') {
      // 설정 화면이 백그라운드에 살아있을 때도 unread 배지가 즉시
      // 갱신되도록 provider invalidate.
      _ref.invalidate(myInquiriesProvider);
      _router.go('/');
      _router.push('/inquiries');
      return;
    }

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
