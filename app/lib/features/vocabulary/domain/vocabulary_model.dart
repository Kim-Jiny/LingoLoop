class VocabularyItem {
  final int id;
  final String word;
  /// 사전형(원형). vocab의 surface가 활용형이면 base가 다름.
  /// e.g. word="ran" → baseWord="run". null이면 미분류.
  final String? baseWord;
  /// ll_word_forms.forms의 키. 'base'/'past'/'plural' 등. null이면 미상.
  final String? form;
  /// 'verb'/'noun'/'adjective'/'adverb'/'other'.
  final String? partOfSpeech;
  final String? meaning;
  final String? context;
  final int? sentenceId;
  final String? sentenceText;
  final String? sentenceTranslation;
  final String status;
  final String? createdAt;

  VocabularyItem({
    required this.id,
    required this.word,
    this.baseWord,
    this.form,
    this.partOfSpeech,
    this.meaning,
    this.context,
    this.sentenceId,
    this.sentenceText,
    this.sentenceTranslation,
    this.status = 'learning',
    this.createdAt,
  });

  bool get isLearned => status == 'learned';

  /// 단어장 UI에서 "run의 과거형" 같은 한글 라벨. baseWord가 surface와
  /// 다를 때만 의미 있음. null이면 라벨 X.
  String? get formLabel {
    final base = baseWord;
    if (base == null || base.isEmpty) return null;
    if (base.toLowerCase() == word.toLowerCase()) return null;
    final f = form;
    if (f == null) return base;
    return '$base의 ${formLabelOf(f)}';
  }

  /// form key → 한글 라벨. detail sheet에서도 재사용하도록 public.
  static String formLabelOf(String key) {
    switch (key) {
      case 'base':
        return '원형';
      case 'past':
        return '과거형';
      case 'pastParticiple':
        return '과거분사';
      case 'presentParticiple':
        return '현재분사';
      case 'thirdPersonSingular':
        return '3인칭 단수';
      case 'singular':
        return '단수형';
      case 'plural':
        return '복수형';
      case 'comparative':
        return '비교급';
      case 'superlative':
        return '최상급';
      default:
        return key;
    }
  }

  factory VocabularyItem.fromJson(Map<String, dynamic> json) {
    return VocabularyItem(
      id: json['id'],
      word: json['word'] ?? '',
      baseWord: json['baseWord'],
      form: json['form'],
      partOfSpeech: json['partOfSpeech'],
      meaning: json['meaning'],
      context: json['context'],
      sentenceId: json['sentenceId'],
      sentenceText: json['sentenceText'],
      sentenceTranslation: json['sentenceTranslation'],
      status: json['status'] ?? 'learning',
      createdAt: json['createdAt'],
    );
  }
}

/// 단어 사전 detail 응답 — 활용형 + 한영 예문 + 품사/뜻.
/// `GET /api/vocabulary/forms/:word`.
class WordFormDetail {
  final String baseWord;
  final String partOfSpeech;
  final String? meaning;
  /// 활용형 key → surface. e.g. { past: 'ran', presentParticiple: 'running' }
  final Map<String, String> forms;
  /// 활용형 key → { en, ko } 예문.
  final Map<String, WordExample> examples;
  /// 사용자가 조회한 surface가 어떤 form인지 (검색어 highlight용).
  final String? matchedForm;

  WordFormDetail({
    required this.baseWord,
    required this.partOfSpeech,
    this.meaning,
    required this.forms,
    required this.examples,
    this.matchedForm,
  });

  factory WordFormDetail.fromJson(Map<String, dynamic> json) {
    final formsRaw = json['forms'] as Map<String, dynamic>? ?? {};
    final examplesRaw = json['examples'] as Map<String, dynamic>? ?? {};
    return WordFormDetail(
      baseWord: json['baseWord'] ?? '',
      partOfSpeech: json['partOfSpeech'] ?? 'other',
      meaning: json['meaning'],
      forms: {
        for (final e in formsRaw.entries) e.key: (e.value ?? '').toString(),
      },
      examples: {
        for (final e in examplesRaw.entries)
          if (e.value is Map)
            e.key: WordExample.fromJson(e.value as Map<String, dynamic>),
      },
      matchedForm: json['matchedForm'],
    );
  }
}

class WordExample {
  final String en;
  final String ko;

  WordExample({required this.en, required this.ko});

  factory WordExample.fromJson(Map<String, dynamic> json) {
    return WordExample(
      en: (json['en'] ?? '').toString(),
      ko: (json['ko'] ?? '').toString(),
    );
  }
}

class VocabularyList {
  final List<VocabularyItem> items;
  final int total;

  VocabularyList({required this.items, required this.total});

  factory VocabularyList.fromJson(Map<String, dynamic> json) {
    return VocabularyList(
      items: (json['items'] as List? ?? [])
          .map((e) => VocabularyItem.fromJson(e))
          .toList(),
      total: json['total'] ?? 0,
    );
  }
}
