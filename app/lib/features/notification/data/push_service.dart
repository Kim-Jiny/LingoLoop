import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;
import 'dart:io';
import 'package:app_settings/app_settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/router/app_router.dart';
import '../../../core/widget/home_widget_service.dart';
import '../../auth/domain/auth_provider.dart';
import '../../subscription/domain/subscription_status_provider.dart';
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
  final service = PushService(ref.read(notificationRepositoryProvider), ref);
  ref.onDispose(service.dispose);
  return service;
});

class PushService {
  final NotificationRepository _repo;
  final Ref _ref;
  bool _initialized = false;
  StreamSubscription<String>? _tokenRefreshSubscription;
  StreamSubscription<RemoteMessage>? _foregroundSubscription;
  StreamSubscription<RemoteMessage>? _openedAppSubscription;

  /// MainActivity.kt의 MethodChannel과 매칭. tag-based 알림 cancel용.
  /// iOS는 foreground banner가 default로 자동 dismiss되므로 대상 X.
  static const _nativeChannel = MethodChannel(
    'com.jiny.lingoloop/notifications',
  );

  PushService(this._repo, this._ref);

  /// 시스템 트레이/알림 센터에서 특정 group의 알림을 정리. 푸시를
  /// in-app으로 처리한 직후 호출해 사용자에게 stale 알림이 남지 않게.
  ///
  /// 양쪽 플랫폼 모두 같은 [group] 식별자를 사용 (서버 측에서
  /// androidTag + iosThreadId 동일 값으로 발행). native에선 각각
  /// NotificationManager tag / UNNotificationContent.threadIdentifier로
  /// 매핑돼 해당 그룹만 정확히 정리됨.
  Future<void> _dismissNotifications(String group) async {
    try {
      if (Platform.isAndroid) {
        await _nativeChannel.invokeMethod('cancelByTag', {'tag': group});
      } else if (Platform.isIOS) {
        await _nativeChannel.invokeMethod('removeByThreadId', {
          'threadId': group,
        });
      }
    } catch (_) {
      // native channel 미등록(예: hot-restart로 engine 재생성) — silent
      // fail. 알림은 다음 사용자 액션 또는 다음 collapse push에서 자연
      // 정리됨.
    }
  }

  /// 로그아웃 또는 사용자 전환 시 호출. 다음 initialize()가 새 토큰
  /// 등록 (서버에서 device_token row의 userId를 새 사용자로 갈아끼움)
  /// 을 다시 수행하게 만듦. 이 reset 없이 두 번째 계정 로그인 시
  /// _initialized=true라 register 호출이 skip돼 푸시가 옛 사용자에게
  /// 계속 가는 버그가 있었음.
  void reset() {
    _initialized = false;
    unawaited(_cancelMessagingHandlers());
  }

  void dispose() {
    _initialized = false;
    unawaited(_cancelMessagingHandlers());
  }

  Future<void> _cancelMessagingHandlers() async {
    await Future.wait([
      ?_tokenRefreshSubscription?.cancel(),
      ?_foregroundSubscription?.cancel(),
      ?_openedAppSubscription?.cancel(),
    ]);
    _tokenRefreshSubscription = null;
    _foregroundSubscription = null;
    _openedAppSubscription = null;
  }

  /// iOS 앱 아이콘 뱃지를 0으로 reset. iOS는 서버 push의 badge 필드를
  /// 그대로 set하고 OS가 자동으로 줄이지 않아 — 첫 푸시에 1로 set된
  /// 뱃지가 사용자가 알림 확인해도 계속 1로 남는 버그. 앱이 foreground
  /// 로 진입할 때 호출해 정리. Android는 launcher가 알림 cancel과
  /// 함께 처리하므로 no-op.
  ///
  /// MethodChannel은 cold launch 시 implicit Flutter engine이 attach
  /// 되기 전 시점에 호출되면 fail. 한 번 짧은 retry로 대응 — 첫 시도
  /// 실패해도 200ms 뒤 다시 호출.
  Future<void> clearIosBadge() async {
    if (!Platform.isIOS) return;
    final ok = await _invokeClearBadge();
    if (!ok) {
      await Future.delayed(const Duration(milliseconds: 200));
      await _invokeClearBadge();
    }
  }

  Future<bool> _invokeClearBadge() async {
    try {
      await _nativeChannel.invokeMethod('clearBadge');
      return true;
    } catch (e) {
      developer.log(
        'clearBadge failed (will retry once): $e',
        name: 'PushService',
      );
      return false;
    }
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
      final settings = await FirebaseMessaging.instance
          .getNotificationSettings();
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
      if (!_initialized) {
        await _wireMessagingHandlers(messaging);
        _initialized = true;
      }
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
      _initialized = true;
    } catch (_) {
      // FCM is intentionally allowed to be absent during early development.
    }
  }

  /// token register + foreground/tap handler + initialMessage 처리.
  /// initialize와 requestPermissionAndInit 양쪽에서 호출하는 공통 본체.
  Future<void> _wireMessagingHandlers(FirebaseMessaging messaging) async {
    await _cancelMessagingHandlers();

    final token = await messaging.getToken();
    if (token != null) {
      final platform = Platform.isIOS ? 'ios' : 'android';
      await _repo.registerToken(token, platform);
    }

    _tokenRefreshSubscription = messaging.onTokenRefresh.listen((
      newToken,
    ) async {
      final platform = Platform.isIOS ? 'ios' : 'android';
      await _repo.registerToken(newToken, platform);
    });

    _foregroundSubscription = FirebaseMessaging.onMessage.listen(
      _handleForegroundMessage,
    );
    _openedAppSubscription = FirebaseMessaging.onMessageOpenedApp.listen(
      _handleMessageTap,
    );

    final initialMessage = await messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleMessageTap(initialMessage);
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    // 사용자가 앱을 사용 중인데 새 push가 도착 — 서버가 badge=1로 set
    // 하므로 즉시 0으로 reset. sceneDidBecomeActive는 이미 active
    // 상태라 fire 안 되므로 native에 명시 호출 필요.
    clearIosBadge();
    // iOS가 foreground notification의 badge 값을 onMessage 이후에
    // 적용하는 경우가 있어, 짧게 한 번 더 지워 최종 상태를 0으로 고정.
    Future.delayed(const Duration(milliseconds: 500), clearIosBadge);

    // admin grant/revoke 직후 서버가 보내는 silent push — 두 provider
    // 모두 새로고침해야 함:
    //   - subscriptionStatusProvider: 구독 화면 / 광고 / 단어 푸시 등
    //   - authStateProvider.user.isPremium: 메인/복습/퀴즈 화면이 이쪽을
    //     봄. 하나만 갱신하면 '설정에선 프리미엄, 메인은 무료' 미스매치.
    // notification 필드가 없어 사용자에겐 알림으로 노출 X.
    if (message.data['type'] == 'subscription_updated') {
      _ref.invalidate(subscriptionStatusProvider);
      _ref.read(authStateProvider.notifier).refreshCurrentUser();
      return;
    }

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

    // 문의 답변이 foreground에서 도착하면 settings 화면의 unread 배지를
    // 즉시 갱신 + 시스템 트레이의 답변 알림을 dismiss. dismiss 없으면
    // in-app으로 본 답변이 트레이에 계속 남아 "왜 안 사라져?" 혼란.
    if (message.data['type'] == 'inquiry_reply') {
      _ref.invalidate(myInquiriesProvider);
      _dismissNotifications('inquiry_reply');
    }

    final context = _router.routerDelegate.navigatorKey.currentContext;
    final messenger = context == null
        ? null
        : ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;
    // clearSnackBars로 큐 + 현재 표시 즉시 비움. 매 푸시마다 새
    // SnackBar가 큐에 누적되면 N*4초 동안 안 사라지는 것처럼 보이는
    // 버그 방지 (사용자가 답변 여러 개 연속 받거나 학습 알림과 겹칠
    // 때 발생). 항상 가장 최근 알림 한 개만 화면에 노출.
    messenger.clearSnackBars();
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          message.notification?.body ??
              message.data['body'] ??
              '새 학습 알림이 도착했어요.',
        ),
        // default 4초보다 짧게 — 사용자가 한 번 봤으면 빠르게 사라져야
        // 다음 작업에 방해 안 됨. "열기" 누르고 싶으면 그 안에 가능.
        duration: const Duration(milliseconds: 2800),
        behavior: SnackBarBehavior.floating,
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
      // 사용자가 알림을 탭한 시점 = 답변 확인 의사 → 시스템 트레이의
      // 알림 + in-app SnackBar 모두 함께 정리. SnackBar 큐가 남아있으면
      // inquiry 화면에 도착해도 하단에 stale 알림이 계속 떠 있는
      // 사용자 보고 ("탭바 위 안 사라짐") 의 직접 원인.
      _dismissNotifications('inquiry_reply');
      final context = _router.routerDelegate.navigatorKey.currentContext;
      if (context != null) {
        ScaffoldMessenger.maybeOf(context)?.clearSnackBars();
      }
      _router.go('/');
      _router.push('/inquiries');
      return;
    }

    final action = data['action'];
    switch (action) {
      case 'vocabulary':
        // 단어 푸시 — 본문이 단어/뜻이므로 단어장으로 이동.
        // /vocabulary는 top-level route라 홈을 먼저 깔아 back stack 유지.
        _router.go('/');
        _router.push('/vocabulary');
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
