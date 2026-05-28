import 'dart:io' show Platform;

import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// 인증 흐름(로그인/리프레시/소셜/회원가입)에서 서버로 함께 보내는
/// 클라이언트 환경 정보. 운영자의 backstage 유저 상세 페이지에서
/// "최근 접속 / 클라이언트" 행을 채우는 데 사용됨.
///
/// 프로세스 생애주기 안에서는 값이 바뀌지 않으므로 첫 호출에 한 번만
/// 계산해 캐시. dio 인터셉터가 Riverpod ref 없이도 접근할 수 있도록
/// 정적 메서드로 노출.
class ClientInfo {
  ClientInfo._();

  static Map<String, dynamic>? _cached;
  static Future<Map<String, dynamic>>? _inflight;

  /// 페이로드 한 벌을 반환. 어느 한 필드 수집에 실패해도 나머지는 그대로
  /// 보냄 — null 필드는 서버에서 무시되도록 DTO가 전부 optional.
  static Future<Map<String, dynamic>> resolve() async {
    if (_cached != null) return _cached!;
    return _inflight ??= _build().then((map) {
      _cached = map;
      _inflight = null;
      return map;
    });
  }

  static Future<Map<String, dynamic>> _build() async {
    final platform = _platformLabel();
    String? osVersion;
    String? deviceModel;
    String? appVersion;
    String? appBuild;

    try {
      final info = DeviceInfoPlugin();
      if (Platform.isIOS) {
        final ios = await info.iosInfo;
        // utsname.machine은 마케팅명 대신 hw identifier(예: iPhone15,2).
        // 운영자가 정확한 모델 매핑을 보고 싶을 때 더 유용.
        deviceModel = ios.utsname.machine.isNotEmpty
            ? ios.utsname.machine
            : ios.model;
        osVersion = ios.systemVersion;
      } else if (Platform.isAndroid) {
        final android = await info.androidInfo;
        deviceModel = android.model;
        osVersion = android.version.release;
      } else {
        // Web/desktop 등은 굳이 안 보내도 운영에 충분.
        osVersion = Platform.operatingSystemVersion;
      }
    } catch (_) {
      // device_info 호출 실패 — OS 버전 정도는 dart:io에서 fallback.
      osVersion = Platform.operatingSystemVersion;
    }

    try {
      final pkg = await PackageInfo.fromPlatform();
      appVersion = pkg.version;
      appBuild = pkg.buildNumber;
    } catch (_) {
      // 무시. appVersion 없어도 OS/모델만으로도 가치 있음.
    }

    return {
      'platform': ?platform,
      'osVersion': ?_orNull(osVersion),
      'appVersion': ?_orNull(appVersion),
      'appBuild': ?_orNull(appBuild),
      'deviceModel': ?_orNull(deviceModel),
    };
  }

  /// PackageInfo는 값이 없으면 빈 문자열을 돌려주므로 ""을 null로 정규화.
  /// 서버 DTO가 빈 문자열을 허용하면 backstage에 빈 칸이 노출되는 걸 막음.
  static String? _orNull(String? s) =>
      (s == null || s.isEmpty) ? null : s;

  static String? _platformLabel() {
    if (Platform.isIOS) return 'ios';
    if (Platform.isAndroid) return 'android';
    if (Platform.isMacOS) return 'macos';
    if (Platform.isWindows) return 'windows';
    if (Platform.isLinux) return 'linux';
    return 'unknown';
  }
}
