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
  /// Unbounded count of sentences currently due — server returns the
  /// real total even for free users (whose `items` is capped). Drives
  /// the "M개 중 N개 표시" copy.
  final int total;

  /// True when the user is free AND `total > freeLimit`. Lets the UI
  /// show an upsell affordance without re-deriving the rule client-
  /// side.
  final bool freeCapped;

  /// The cap applied for free users (null if premium).
  final int? freeLimit;
  final List<ReviewItem> items;

  ReviewQueue({
    required this.total,
    required this.freeCapped,
    required this.freeLimit,
    required this.items,
  });

  factory ReviewQueue.fromJson(Map<String, dynamic> json) {
    return ReviewQueue(
      total: json['total'] ?? 0,
      freeCapped: json['freeCapped'] == true,
      freeLimit: json['freeLimit'] is int ? json['freeLimit'] as int : null,
      items: (json['items'] as List? ?? [])
          .map((e) => ReviewItem.fromJson(e))
          .toList(),
    );
  }
}
