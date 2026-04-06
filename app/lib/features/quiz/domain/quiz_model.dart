enum QuizType {
  fillBlank,
  wordOrder,
  translation,
  multipleChoice;

  factory QuizType.fromString(String value) {
    switch (value) {
      case 'fill_blank':
        return QuizType.fillBlank;
      case 'word_order':
        return QuizType.wordOrder;
      case 'translation':
        return QuizType.translation;
      case 'multiple_choice':
        return QuizType.multipleChoice;
      default:
        return QuizType.fillBlank;
    }
  }

  String get displayName {
    switch (this) {
      case QuizType.fillBlank:
        return '빈칸 채우기';
      case QuizType.wordOrder:
        return '단어 배열';
      case QuizType.translation:
        return '번역하기';
      case QuizType.multipleChoice:
        return '객관식';
    }
  }
}

class QuizQuestion {
  final int id;
  final QuizType type;
  final int sentenceId;
  final Map<String, dynamic> question;
  final bool isAttempted;

  QuizQuestion({
    required this.id,
    required this.type,
    required this.sentenceId,
    required this.question,
    required this.isAttempted,
  });

  factory QuizQuestion.fromJson(Map<String, dynamic> json) {
    return QuizQuestion(
      id: json['id'],
      type: QuizType.fromString(json['type']),
      sentenceId: json['sentenceId'],
      question: Map<String, dynamic>.from(json['question']),
      isAttempted: json['isAttempted'] ?? false,
    );
  }
}

class DailyQuiz {
  final List<QuizQuestion> quizzes;
  final int total;

  DailyQuiz({required this.quizzes, required this.total});

  factory DailyQuiz.fromJson(Map<String, dynamic> json) {
    return DailyQuiz(
      quizzes: (json['quizzes'] as List)
          .map((q) => QuizQuestion.fromJson(q))
          .toList(),
      total: json['total'],
    );
  }
}

class QuizResult {
  final int attemptId;
  final bool isCorrect;
  final Map<String, dynamic> correctAnswer;
  final String? explanation;

  QuizResult({
    required this.attemptId,
    required this.isCorrect,
    required this.correctAnswer,
    this.explanation,
  });

  factory QuizResult.fromJson(Map<String, dynamic> json) {
    return QuizResult(
      attemptId: json['attemptId'],
      isCorrect: json['isCorrect'],
      correctAnswer: Map<String, dynamic>.from(json['correctAnswer']),
      explanation: json['explanation'],
    );
  }
}

class QuizHistory {
  final List<QuizHistoryItem> items;
  final int total;
  final int page;
  final int totalPages;

  QuizHistory({
    required this.items,
    required this.total,
    required this.page,
    required this.totalPages,
  });

  factory QuizHistory.fromJson(Map<String, dynamic> json) {
    return QuizHistory(
      items: (json['items'] as List? ?? [])
          .map((item) => QuizHistoryItem.fromJson(item))
          .toList(),
      total: json['total'] ?? 0,
      page: json['page'] ?? 1,
      totalPages: json['totalPages'] ?? 1,
    );
  }
}

class QuizHistoryItem {
  final int id;
  final String quizType;
  final Map<String, dynamic> question;
  final Map<String, dynamic> userAnswer;
  final Map<String, dynamic> correctAnswer;
  final bool isCorrect;
  final String? sentenceText;
  final String attemptedAt;

  QuizHistoryItem({
    required this.id,
    required this.quizType,
    required this.question,
    required this.userAnswer,
    required this.correctAnswer,
    required this.isCorrect,
    required this.sentenceText,
    required this.attemptedAt,
  });

  factory QuizHistoryItem.fromJson(Map<String, dynamic> json) {
    return QuizHistoryItem(
      id: json['id'],
      quizType: json['quizType'],
      question: Map<String, dynamic>.from(json['question'] ?? {}),
      userAnswer: Map<String, dynamic>.from(json['userAnswer'] ?? {}),
      correctAnswer: Map<String, dynamic>.from(json['correctAnswer'] ?? {}),
      isCorrect: json['isCorrect'] ?? false,
      sentenceText: json['sentenceText'],
      attemptedAt: json['attemptedAt'] ?? '',
    );
  }
}
