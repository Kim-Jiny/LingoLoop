import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/data/auth_repository.dart';
import '../../auth/domain/auth_provider.dart';

/// 사용자가 각 언어별로 저장한 트랙. authState가 바뀌면(로그인/탈퇴/계정
/// 전환) 자동 재조회 — `ref.watch(authStateProvider)`로 의존성 연결.
///
/// 응답: `[(languageCode, track), …]` — 트랙 미선택 언어는 없음.
final languageTracksProvider =
    FutureProvider<List<({String languageCode, String track})>>((ref) async {
  // 로그인 사용자 ID가 바뀌면 invalidate. 비로그인이면 빈 리스트 즉시 반환.
  final user = ref.watch(authStateProvider).asData?.value;
  if (user == null) return const [];
  return ref.read(authRepositoryProvider).listLanguageTracks();
});

/// 사용자가 한 번이라도 학습 언어를 선택한 적이 있는지. 온보딩 라우터
/// 가드에서 사용 — false면 /language로 redirect.
bool hasAnyLanguageTrack(
  AsyncValue<List<({String languageCode, String track})>> async,
) {
  final list = async.asData?.value;
  if (list == null) return false; // loading/error 동안엔 미선택으로 취급
  return list.isNotEmpty;
}
