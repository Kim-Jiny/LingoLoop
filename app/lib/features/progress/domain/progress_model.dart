class LearningStats {
  final int totalSentences;
  final int completedSentences;
  final int streak;
  final int quizTotalAttempts;
  final int quizCorrectCount;
  final int quizAccuracy;
  final int avgMasteryScore;

  LearningStats({
    required this.totalSentences,
    required this.completedSentences,
    required this.streak,
    required this.quizTotalAttempts,
    required this.quizCorrectCount,
    required this.quizAccuracy,
    required this.avgMasteryScore,
  });

  factory LearningStats.fromJson(Map<String, dynamic> json) {
    return LearningStats(
      totalSentences: json['totalSentences'] ?? 0,
      completedSentences: json['completedSentences'] ?? 0,
      streak: json['streak'] ?? 0,
      quizTotalAttempts: json['quizTotalAttempts'] ?? 0,
      quizCorrectCount: json['quizCorrectCount'] ?? 0,
      quizAccuracy: json['quizAccuracy'] ?? 0,
      avgMasteryScore: json['avgMasteryScore'] ?? 0,
    );
  }
}

class SentenceProgressPage {
  final List<SentenceProgressItem> items;
  final int total;
  final int page;
  final int totalPages;

  SentenceProgressPage({
    required this.items,
    required this.total,
    required this.page,
    required this.totalPages,
  });

  factory SentenceProgressPage.fromJson(Map<String, dynamic> json) {
    return SentenceProgressPage(
      items: (json['items'] as List? ?? [])
          .map((item) => SentenceProgressItem.fromJson(item))
          .toList(),
      total: json['total'] ?? 0,
      page: json['page'] ?? 1,
      totalPages: json['totalPages'] ?? 1,
    );
  }
}

class SentenceProgressItem {
  final int sentenceId;
  final String? sentenceText;
  final String? sentenceTranslation;
  final int exposureCount;
  final int quizAttempts;
  final int quizCorrect;
  final int masteryScore;
  final String? lastExposedAt;
  final String? lastQuizAt;

  SentenceProgressItem({
    required this.sentenceId,
    required this.sentenceText,
    required this.sentenceTranslation,
    required this.exposureCount,
    required this.quizAttempts,
    required this.quizCorrect,
    required this.masteryScore,
    required this.lastExposedAt,
    required this.lastQuizAt,
  });

  factory SentenceProgressItem.fromJson(Map<String, dynamic> json) {
    return SentenceProgressItem(
      sentenceId: json['sentenceId'] ?? 0,
      sentenceText: json['sentenceText'],
      sentenceTranslation: json['sentenceTranslation'],
      exposureCount: json['exposureCount'] ?? 0,
      quizAttempts: json['quizAttempts'] ?? 0,
      quizCorrect: json['quizCorrect'] ?? 0,
      masteryScore: (json['masteryScore'] ?? 0).round(),
      lastExposedAt: json['lastExposedAt'],
      lastQuizAt: json['lastQuizAt'],
    );
  }
}
