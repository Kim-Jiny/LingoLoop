import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'version_gate.dart';

/// 스토어 버전 조회 결과. URL은 사용자가 업데이트 버튼을 눌렀을 때
/// 열어줄 store deep link. version은 dot-separated semver
/// (예: "1.1.0"). updateAvailable은 현재 앱 버전과 비교한 결과.
@immutable
class StoreVersionInfo {
  final String latestVersion;
  final String currentVersion;
  final String storeUrl;
  final bool updateAvailable;

  const StoreVersionInfo({
    required this.latestVersion,
    required this.currentVersion,
    required this.storeUrl,
    required this.updateAvailable,
  });
}

/// `null`은 스토어 응답을 못 받았거나 비교 불가 — UI는 표시 안 함.
final storeVersionProvider = FutureProvider<StoreVersionInfo?>((ref) async {
  if (kIsWeb) return null;
  final info = await ref.watch(packageInfoProvider.future);
  final current = info.version;

  try {
    if (Platform.isIOS) {
      return await _fetchIos(current);
    }
    if (Platform.isAndroid) {
      return await _fetchAndroid(current);
    }
  } catch (_) {
    return null;
  }
  return null;
});

const _iosBundleId = 'com.jiny.lingoloop';
const _iosAppId = '6770874750';
const _androidPackage = 'com.jiny.lingoloop';

Future<StoreVersionInfo?> _fetchIos(String current) async {
  // iTunes Lookup — 공식 비공식 모두 사용하는 안정적인 endpoint. country는
  // 가격/언어 메타에만 영향, version 자체는 country 무관하게 동일하지만
  // kr/us 둘 다 시도해 region rollout 차이를 흡수.
  final dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 5),
    receiveTimeout: const Duration(seconds: 5),
  ));
  String? latest;
  for (final country in const ['kr', 'us']) {
    final res = await dio.get<Map<String, dynamic>>(
      'https://itunes.apple.com/lookup',
      queryParameters: {'bundleId': _iosBundleId, 'country': country},
      options: Options(responseType: ResponseType.json),
    );
    final results = (res.data?['results'] as List?) ?? const [];
    if (results.isNotEmpty) {
      final v = (results.first as Map)['version']?.toString();
      if (v != null && v.isNotEmpty) {
        latest = v;
        break;
      }
    }
  }
  if (latest == null) return null;
  return StoreVersionInfo(
    latestVersion: latest,
    currentVersion: current,
    storeUrl: 'https://apps.apple.com/app/id$_iosAppId',
    updateAvailable: _isNewer(latest, current),
  );
}

Future<StoreVersionInfo?> _fetchAndroid(String current) async {
  final dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 5),
    receiveTimeout: const Duration(seconds: 5),
    responseType: ResponseType.plain,
    headers: {
      // 일부 region에서 user-agent 없이는 빈 페이지 — 데스크탑 브라우저
      // UA로 위장해 안정적인 HTML을 받음.
      'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  ));
  final res = await dio.get<String>(
    'https://play.google.com/store/apps/details',
    queryParameters: {'id': _androidPackage, 'hl': 'ko'},
  );
  final html = res.data ?? '';
  // Play Store가 HTML에 박는 JSON 페이로드에서 currentVersion만 추출.
  // 가장 자주 쓰이는 패턴: `[[["1.2.3"]]]` 형태로 직렬화된 단일 문자열.
  // store가 포맷을 바꿀 수 있어 여러 fallback을 순차 시도.
  final candidates = [
    RegExp(r'\[\[\["(\d+(?:\.\d+){1,3})"\]\]'),
    RegExp(r'"softwareVersion"\s*:\s*"(\d+(?:\.\d+){1,3})"'),
    RegExp(r'Current Version.*?(\d+\.\d+(?:\.\d+)?)', dotAll: true),
  ];
  String? latest;
  for (final r in candidates) {
    final m = r.firstMatch(html);
    if (m != null) {
      latest = m.group(1);
      if (latest != null && latest.isNotEmpty) break;
    }
  }
  if (latest == null || latest.isEmpty) return null;
  return StoreVersionInfo(
    latestVersion: latest,
    currentVersion: current,
    storeUrl:
        'https://play.google.com/store/apps/details?id=$_androidPackage',
    updateAvailable: _isNewer(latest, current),
  );
}

/// `latest > current` ? — 빌드 넘버('1.0.0+4')는 strip, 부족한 segment는 0.
bool _isNewer(String latest, String current) {
  final l = _parts(latest);
  final c = _parts(current);
  final len = l.length > c.length ? l.length : c.length;
  for (var i = 0; i < len; i++) {
    final a = i < l.length ? l[i] : 0;
    final b = i < c.length ? c[i] : 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

List<int> _parts(String v) => v
    .split('+')
    .first
    .split('.')
    .map((s) => int.tryParse(s) ?? 0)
    .toList();
