class VocabularyItem {
  final int id;
  final String word;
  final String? meaning;
  final String? context;
  final int? sentenceId;
  final String? sentenceText;
  final String? createdAt;

  VocabularyItem({
    required this.id,
    required this.word,
    this.meaning,
    this.context,
    this.sentenceId,
    this.sentenceText,
    this.createdAt,
  });

  factory VocabularyItem.fromJson(Map<String, dynamic> json) {
    return VocabularyItem(
      id: json['id'],
      word: json['word'] ?? '',
      meaning: json['meaning'],
      context: json['context'],
      sentenceId: json['sentenceId'],
      sentenceText: json['sentenceText'],
      createdAt: json['createdAt'],
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
