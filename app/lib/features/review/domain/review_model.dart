import '../../sentence/domain/sentence_model.dart';

class ReviewItem {
  final int sentenceId;
  final int masteryScore;
  final int overdueDays;
  final SentenceDetail sentence;

  ReviewItem({
    required this.sentenceId,
    required this.masteryScore,
    required this.overdueDays,
    required this.sentence,
  });

  factory ReviewItem.fromJson(Map<String, dynamic> json) {
    return ReviewItem(
      sentenceId: json['sentenceId'] ?? 0,
      masteryScore: (json['masteryScore'] ?? 0).round(),
      overdueDays: json['overdueDays'] ?? 0,
      sentence: SentenceDetail.fromJson(json['sentence']),
    );
  }
}

class ReviewQueue {
  final int total;
  final List<ReviewItem> items;

  ReviewQueue({required this.total, required this.items});

  factory ReviewQueue.fromJson(Map<String, dynamic> json) {
    return ReviewQueue(
      total: json['total'] ?? 0,
      items: (json['items'] as List? ?? [])
          .map((e) => ReviewItem.fromJson(e))
          .toList(),
    );
  }
}
