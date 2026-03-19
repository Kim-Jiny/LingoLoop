class TodaySentence {
  final int assignmentId;
  final String assignedDate;
  final bool isCompleted;
  final SentenceDetail sentence;

  TodaySentence({
    required this.assignmentId,
    required this.assignedDate,
    required this.isCompleted,
    required this.sentence,
  });

  factory TodaySentence.fromJson(Map<String, dynamic> json) {
    return TodaySentence(
      assignmentId: json['assignmentId'],
      assignedDate: json['assignedDate'],
      isCompleted: json['isCompleted'] ?? false,
      sentence: SentenceDetail.fromJson(json['sentence']),
    );
  }
}

class SentenceDetail {
  final int id;
  final String text;
  final String translation;
  final String? pronunciation;
  final String? situation;
  final String difficulty;
  final String? category;
  final List<WordDetail> words;
  final List<GrammarNoteDetail> grammarNotes;

  SentenceDetail({
    required this.id,
    required this.text,
    required this.translation,
    this.pronunciation,
    this.situation,
    required this.difficulty,
    this.category,
    required this.words,
    required this.grammarNotes,
  });

  factory SentenceDetail.fromJson(Map<String, dynamic> json) {
    return SentenceDetail(
      id: json['id'],
      text: json['text'],
      translation: json['translation'],
      pronunciation: json['pronunciation'],
      situation: json['situation'],
      difficulty: json['difficulty'] ?? 'beginner',
      category: json['category'],
      words: (json['words'] as List? ?? [])
          .map((w) => WordDetail.fromJson(w))
          .toList(),
      grammarNotes: (json['grammarNotes'] as List? ?? [])
          .map((g) => GrammarNoteDetail.fromJson(g))
          .toList(),
    );
  }
}

class WordDetail {
  final String word;
  final String meaning;
  final String? pronunciation;
  final String? partOfSpeech;
  final String? example;

  WordDetail({
    required this.word,
    required this.meaning,
    this.pronunciation,
    this.partOfSpeech,
    this.example,
  });

  factory WordDetail.fromJson(Map<String, dynamic> json) {
    return WordDetail(
      word: json['word'],
      meaning: json['meaning'],
      pronunciation: json['pronunciation'],
      partOfSpeech: json['partOfSpeech'],
      example: json['example'],
    );
  }
}

class GrammarNoteDetail {
  final String title;
  final String explanation;
  final String? example;

  GrammarNoteDetail({
    required this.title,
    required this.explanation,
    this.example,
  });

  factory GrammarNoteDetail.fromJson(Map<String, dynamic> json) {
    return GrammarNoteDetail(
      title: json['title'],
      explanation: json['explanation'],
      example: json['example'],
    );
  }
}

class SentenceHistory {
  final List<SentenceHistoryItem> items;
  final int total;
  final int page;
  final int totalPages;

  SentenceHistory({
    required this.items,
    required this.total,
    required this.page,
    required this.totalPages,
  });

  factory SentenceHistory.fromJson(Map<String, dynamic> json) {
    return SentenceHistory(
      items: (json['items'] as List)
          .map((i) => SentenceHistoryItem.fromJson(i))
          .toList(),
      total: json['total'],
      page: json['page'],
      totalPages: json['totalPages'],
    );
  }
}

class SentenceHistoryItem {
  final String assignedDate;
  final bool isCompleted;
  final SentenceSummary sentence;

  SentenceHistoryItem({
    required this.assignedDate,
    required this.isCompleted,
    required this.sentence,
  });

  factory SentenceHistoryItem.fromJson(Map<String, dynamic> json) {
    return SentenceHistoryItem(
      assignedDate: json['assignedDate'],
      isCompleted: json['isCompleted'] ?? false,
      sentence: SentenceSummary.fromJson(json['sentence']),
    );
  }
}

class SentenceSummary {
  final int id;
  final String text;
  final String translation;
  final String difficulty;

  SentenceSummary({
    required this.id,
    required this.text,
    required this.translation,
    required this.difficulty,
  });

  factory SentenceSummary.fromJson(Map<String, dynamic> json) {
    return SentenceSummary(
      id: json['id'],
      text: json['text'],
      translation: json['translation'],
      difficulty: json['difficulty'] ?? 'beginner',
    );
  }
}
