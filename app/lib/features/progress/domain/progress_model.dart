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

class Achievement {
  final String code;
  final String title;
  final String description;
  final String icon;
  final int current;
  final int target;
  final double progress;
  final bool unlocked;

  Achievement({
    required this.code,
    required this.title,
    required this.description,
    required this.icon,
    required this.current,
    required this.target,
    required this.progress,
    required this.unlocked,
  });

  factory Achievement.fromJson(Map<String, dynamic> json) {
    return Achievement(
      code: json['code'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      icon: json['icon'] ?? 'star',
      current: json['current'] ?? 0,
      target: json['target'] ?? 1,
      progress: (json['progress'] ?? 0).toDouble(),
      unlocked: json['unlocked'] ?? false,
    );
  }
}

class AchievementSummary {
  final int unlockedCount;
  final int total;
  final List<Achievement> achievements;

  AchievementSummary({
    required this.unlockedCount,
    required this.total,
    required this.achievements,
  });

  factory AchievementSummary.fromJson(Map<String, dynamic> json) {
    return AchievementSummary(
      unlockedCount: json['unlockedCount'] ?? 0,
      total: json['total'] ?? 0,
      achievements: (json['achievements'] as List? ?? [])
          .map((e) => Achievement.fromJson(e))
          .toList(),
    );
  }
}

class WeeklyDay {
  final String date;
  final int sentences;
  final int completed;
  final int quizAttempts;
  final int quizCorrect;

  WeeklyDay({
    required this.date,
    required this.sentences,
    required this.completed,
    required this.quizAttempts,
    required this.quizCorrect,
  });

  factory WeeklyDay.fromJson(Map<String, dynamic> json) {
    return WeeklyDay(
      date: json['date'] ?? '',
      sentences: json['sentences'] ?? 0,
      completed: json['completed'] ?? 0,
      quizAttempts: json['quizAttempts'] ?? 0,
      quizCorrect: json['quizCorrect'] ?? 0,
    );
  }
}

class WeeklyReport {
  final String from;
  final String to;
  final int streak;
  final int vocabAdded;
  final int totalSentences;
  final int totalCompleted;
  final int totalQuizAttempts;
  final int totalQuizCorrect;
  final int quizAccuracy;
  final int activeDays;
  final List<WeeklyDay> daily;

  WeeklyReport({
    required this.from,
    required this.to,
    required this.streak,
    required this.vocabAdded,
    required this.totalSentences,
    required this.totalCompleted,
    required this.totalQuizAttempts,
    required this.totalQuizCorrect,
    required this.quizAccuracy,
    required this.activeDays,
    required this.daily,
  });

  factory WeeklyReport.fromJson(Map<String, dynamic> json) {
    final totals = json['totals'] ?? {};
    return WeeklyReport(
      from: json['from'] ?? '',
      to: json['to'] ?? '',
      streak: json['streak'] ?? 0,
      vocabAdded: json['vocabAdded'] ?? 0,
      totalSentences: totals['sentences'] ?? 0,
      totalCompleted: totals['completed'] ?? 0,
      totalQuizAttempts: totals['quizAttempts'] ?? 0,
      totalQuizCorrect: totals['quizCorrect'] ?? 0,
      quizAccuracy: totals['quizAccuracy'] ?? 0,
      activeDays: totals['activeDays'] ?? 0,
      daily: (json['daily'] as List? ?? [])
          .map((e) => WeeklyDay.fromJson(e))
          .toList(),
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
