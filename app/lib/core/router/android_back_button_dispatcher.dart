import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

class AndroidBackButtonDispatcher extends RootBackButtonDispatcher {
  AndroidBackButtonDispatcher({
    required this.router,
    required this.scaffoldMessengerKey,
  });

  final GoRouter router;
  final GlobalKey<ScaffoldMessengerState> scaffoldMessengerKey;

  DateTime? _lastBackPressedAt;

  bool get _isAndroid => !kIsWeb && Platform.isAndroid;

  @override
  Future<bool> didPopRoute() async {
    if (!_isAndroid) return super.didPopRoute();

    final didPop = await router.routerDelegate.popRoute();
    if (didPop) {
      _lastBackPressedAt = null;
      return true;
    }

    final path = router.routerDelegate.currentConfiguration.uri.path;
    if (!_isMainTabPath(path)) return false;

    if (path != '/') {
      _lastBackPressedAt = null;
      scaffoldMessengerKey.currentState?.hideCurrentSnackBar();
      router.go('/');
      return true;
    }

    final now = DateTime.now();
    if (_lastBackPressedAt != null &&
        now.difference(_lastBackPressedAt!) < const Duration(seconds: 2)) {
      await SystemNavigator.pop();
      return true;
    }

    _lastBackPressedAt = now;
    scaffoldMessengerKey.currentState
      ?..hideCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(
          content: Text('한 번 더 뒤로가기를 누르면 종료됩니다.'),
          duration: Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
    return true;
  }

  bool _isMainTabPath(String path) {
    return path == '/' ||
        path == '/review' ||
        path == '/progress' ||
        path == '/settings';
  }
}
