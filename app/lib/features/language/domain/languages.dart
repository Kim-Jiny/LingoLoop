/// 지원하는 학습 언어 메타데이터. 신규 언어 추가는 여기에 row 한 줄.
///
/// `code`는 서버 `ll_languages.code`와 1:1 매칭 — 서버 트랙 lookup 키.
class LearningLanguage {
  /// ISO 639-1 (또는 서버 정의) 코드. 예: 'en', 'ja'.
  final String code;

  /// 한국어 표기 — 설정 화면에 노출.
  final String labelKo;

  /// 영문/현지어 표기 — 카드 부제목.
  final String labelLocal;

  /// 짧은 한 줄 설명 — 카드 부연 설명.
  final String description;

  /// flag/대표 글리프(이모지). 이모지 폰트가 모든 OS에서 컬러 렌더링되므로
  /// 별도 SVG 자산 없이 카드 비주얼 확보.
  final String glyph;

  const LearningLanguage({
    required this.code,
    required this.labelKo,
    required this.labelLocal,
    required this.description,
    required this.glyph,
  });
}

const supportedLanguages = <LearningLanguage>[
  LearningLanguage(
    code: 'en',
    labelKo: '영어',
    labelLocal: 'English',
    description: '일상 대화부터 시험 영어까지 — 초·중·고급, 토익, 토플, 회화',
    glyph: '🇺🇸',
  ),
  LearningLanguage(
    code: 'ja',
    labelKo: '일본어',
    labelLocal: '日本語',
    description: 'JLPT N5~N1, JPT, 회화까지 — 단계별 트랙 제공',
    glyph: '🇯🇵',
  ),
];

LearningLanguage? findLanguage(String code) {
  for (final l in supportedLanguages) {
    if (l.code == code) return l;
  }
  return null;
}
