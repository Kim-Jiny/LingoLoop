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
