import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const languageSelectedKey = 'language_selected_v1';

/// 사용자가 명시적으로 학습 언어를 한 번이라도 선택했는지.
///
/// 서버 측은 ll_user_language_tracks에 (user, lang) 행을 트랙이 정해질
/// 때만 만듦 — 따라서 신규 유저가 /language에서 언어만 고르고 트랙 선택
/// 화면으로 넘어가는 사이엔 server에 "언어 선택했음" 흔적이 없음. 결과로
/// languageTracksProvider 가 빈 배열을 반환해 라우터의 hasAnyLang 가드가
/// false로 평가, /track으로 push해도 redirect가 /language로 되돌리는 사이클
/// 발생. 이를 끊기 위해 클라이언트가 명시 선택 사실을 따로 기록.
///
/// onboardingSeenProvider 와 동일 패턴 — SharedPreferences로 영구화하고
/// 부팅 시 main.dart에서 초기값을 override로 주입.
class LanguageSelectedNotifier extends Notifier<bool> {
  LanguageSelectedNotifier([this._initial = false]);

  final bool _initial;

  @override
  bool build() => _initial;

  /// /language 화면에서 updateProfile 성공 후 호출. 다음 router refresh가
  /// hasAnyLang=true로 인식하게 함.
  Future<void> markSelected() async {
    state = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(languageSelectedKey, true);
  }
}

final languageSelectedProvider =
    NotifierProvider<LanguageSelectedNotifier, bool>(
  LanguageSelectedNotifier.new,
);
