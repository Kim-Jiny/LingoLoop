import 'package:flutter/material.dart';

/// 트랙 그루핑 — 트랙 선택 화면에서 섹션 헤더로 표시.
enum TrackGroup {
  /// 일상 학습 (초/중/고급)
  general,

  /// 시험 대비 (TOEIC, TOEFL, JLPT, JPT 등)
  exam,

  /// 회화 중심
  conversation,
}

class LearningTrack {
  /// 서버 user.learningTrack 값과 1:1. 변경 시 데이터 마이그레이션 필수.
  final String key;

  /// 화면에 보이는 라벨.
  final String label;

  /// 한 줄 설명.
  final String description;

  /// 카드 아이콘.
  final IconData icon;

  /// 섹션 그루핑 (UI 분류만, 서버는 모름).
  final TrackGroup group;

  const LearningTrack({
    required this.key,
    required this.label,
    required this.description,
    required this.icon,
    required this.group,
  });
}

/// 언어별 트랙 목록. 신규 트랙 추가는 여기.
/// 서버 sentence.track 컬럼은 free-form varchar라 클라가 단독으로 정의 가능
/// — 그 트랙에 해당하는 콘텐츠는 별도 시드 작업 필요.
const _en = <LearningTrack>[
  LearningTrack(
    key: 'beginner',
    label: '초급',
    description: '기초 단어와 짧은 문장부터',
    icon: Icons.spa_rounded,
    group: TrackGroup.general,
  ),
  LearningTrack(
    key: 'intermediate',
    label: '중급',
    description: '일상 표현을 넓혀가는 단계',
    icon: Icons.trending_up_rounded,
    group: TrackGroup.general,
  ),
  LearningTrack(
    key: 'advanced',
    label: '고급',
    description: '자연스럽고 정교한 표현',
    icon: Icons.workspace_premium_rounded,
    group: TrackGroup.general,
  ),
  LearningTrack(
    key: 'toeic',
    label: '토익(TOEIC)',
    description: '비즈니스·실무 시험 대비',
    icon: Icons.business_center_rounded,
    group: TrackGroup.exam,
  ),
  LearningTrack(
    key: 'toefl',
    label: '토플(TOEFL)',
    description: '학술 영어·유학 대비',
    icon: Icons.school_rounded,
    group: TrackGroup.exam,
  ),
  LearningTrack(
    key: 'conversation',
    label: '회화',
    description: '실전 대화 중심 연습',
    icon: Icons.forum_rounded,
    group: TrackGroup.conversation,
  ),
];

const _ja = <LearningTrack>[
  LearningTrack(
    key: 'beginner',
    label: '초급',
    description: '히라가나·기초 표현부터',
    icon: Icons.spa_rounded,
    group: TrackGroup.general,
  ),
  LearningTrack(
    key: 'intermediate',
    label: '중급',
    description: '일상 회화에 자주 쓰이는 표현',
    icon: Icons.trending_up_rounded,
    group: TrackGroup.general,
  ),
  LearningTrack(
    key: 'advanced',
    label: '고급',
    description: '관용 표현·뉴스/뉴스레터 수준',
    icon: Icons.workspace_premium_rounded,
    group: TrackGroup.general,
  ),
  LearningTrack(
    key: 'jlpt_n5',
    label: 'JLPT N5',
    description: '기본 한자·일상 표현',
    icon: Icons.looks_5_rounded,
    group: TrackGroup.exam,
  ),
  LearningTrack(
    key: 'jlpt_n4',
    label: 'JLPT N4',
    description: '기초 회화·짧은 글',
    icon: Icons.looks_4_rounded,
    group: TrackGroup.exam,
  ),
  LearningTrack(
    key: 'jlpt_n3',
    label: 'JLPT N3',
    description: '일상 화제·중간 난도',
    icon: Icons.looks_3_rounded,
    group: TrackGroup.exam,
  ),
  LearningTrack(
    key: 'jlpt_n2',
    label: 'JLPT N2',
    description: '폭넓은 주제·고급 한자',
    icon: Icons.looks_two_rounded,
    group: TrackGroup.exam,
  ),
  LearningTrack(
    key: 'jlpt_n1',
    label: 'JLPT N1',
    description: '복잡한 글·관용 표현',
    icon: Icons.looks_one_rounded,
    group: TrackGroup.exam,
  ),
  LearningTrack(
    key: 'jpt',
    label: 'JPT',
    description: '비즈니스·실무 일본어',
    icon: Icons.business_center_rounded,
    group: TrackGroup.exam,
  ),
  LearningTrack(
    key: 'conversation',
    label: '회화',
    description: '실전 대화 중심',
    icon: Icons.forum_rounded,
    group: TrackGroup.conversation,
  ),
];

const _fallback = <LearningTrack>[];

List<LearningTrack> tracksForLanguage(String languageCode) {
  switch (languageCode) {
    case 'en':
      return _en;
    case 'ja':
      return _ja;
    default:
      return _fallback;
  }
}

LearningTrack? findTrack(String languageCode, String key) {
  for (final t in tracksForLanguage(languageCode)) {
    if (t.key == key) return t;
  }
  return null;
}

String trackGroupLabel(TrackGroup g) {
  switch (g) {
    case TrackGroup.general:
      return '일반';
    case TrackGroup.exam:
      return '시험 대비';
    case TrackGroup.conversation:
      return '회화';
  }
}
