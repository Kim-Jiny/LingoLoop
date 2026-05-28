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
  /// 'beginner' | 'intermediate' | 'advanced' — null for legacy quizzes.
  final String? difficulty;

  QuizQuestion({
    required this.id,
    required this.type,
    required this.sentenceId,
    required this.question,
    required this.isAttempted,
    this.difficulty,
  });

  factory QuizQuestion.fromJson(Map<String, dynamic> json) {
    return QuizQuestion(
      id: json['id'],
      type: QuizType.fromString(json['type']),
      sentenceId: json['sentenceId'],
      question: Map<String, dynamic>.from(json['question']),
      isAttempted: json['isAttempted'] ?? false,
      difficulty: json['difficulty'] as String?,
    );
  }
}

class DailyQuiz {
  final List<QuizQuestion> quizzes;
  final int total;
  /// 단어장학습/완료복습 응답에만 포함 — 사용자의 해당 status vocab
  /// 총 개수. 클라가 "단어장 비어있음(0)" vs "오늘 풀 단어 다 떨어짐
  /// (>0)" 를 구분하는 데 사용. 다른 quiz endpoint에선 null.
  final int? vocabCount;

  DailyQuiz({required this.quizzes, required this.total, this.vocabCount});

  factory DailyQuiz.fromJson(Map<String, dynamic> json) {
    return DailyQuiz(
      quizzes: (json['quizzes'] as List)
          .map((q) => QuizQuestion.fromJson(q))
          .toList(),
      total: json['total'],
      vocabCount: json['vocabCount'] as int?,
    );
  }
}

class QuizResult {
  final int attemptId;
  final bool isCorrect;
  final Map<String, dynamic> correctAnswer;
  /// Structured explanation card. `null` only for legacy responses
  /// that pre-dated the explanation payload — new server always
  /// returns this.
  final QuizExplanation? explanation;

  QuizResult({
    required this.attemptId,
    required this.isCorrect,
    required this.correctAnswer,
    this.explanation,
  });

  factory QuizResult.fromJson(Map<String, dynamic> json) {
    final exp = json['explanation'];
    return QuizResult(
      attemptId: json['attemptId'],
      isCorrect: json['isCorrect'],
      correctAnswer: Map<String, dynamic>.from(json['correctAnswer']),
      explanation: exp is Map<String, dynamic>
          ? QuizExplanation.fromJson(exp)
          : null,
    );
  }
}

class QuizExplanation {
  final String? fullSentence;
  final String? translation;
  final String? pronunciation;
  final String? difficulty;
  final String? situation;
  final List<QuizWordHint> words;
  final List<QuizGrammarNote> grammarNotes;
  /// `{kind: 'word'|'sentence', word?, meaning?, ...}` — UI uses this
  /// to decide what to emphasise (the missed word, the grammar rule,
  /// etc.).
  final Map<String, dynamic>? focus;

  QuizExplanation({
    required this.fullSentence,
    required this.translation,
    required this.pronunciation,
    required this.difficulty,
    required this.situation,
    required this.words,
    required this.grammarNotes,
    required this.focus,
  });

  factory QuizExplanation.fromJson(Map<String, dynamic> json) {
    return QuizExplanation(
      fullSentence: json['fullSentence'] as String?,
      translation: json['translation'] as String?,
      pronunciation: json['pronunciation'] as String?,
      difficulty: json['difficulty'] as String?,
      situation: json['situation'] as String?,
      words: (json['words'] as List? ?? [])
          .map((w) => QuizWordHint.fromJson(Map<String, dynamic>.from(w)))
          .toList(),
      grammarNotes: (json['grammarNotes'] as List? ?? [])
          .map((g) => QuizGrammarNote.fromJson(Map<String, dynamic>.from(g)))
          .toList(),
      focus: json['focus'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(json['focus'])
          : null,
    );
  }
}

class QuizWordHint {
  final String word;
  final String meaning;
  final String? partOfSpeech;
  final String? pronunciation;
  final String? example;
  QuizWordHint({
    required this.word,
    required this.meaning,
    this.partOfSpeech,
    this.pronunciation,
    this.example,
  });
  factory QuizWordHint.fromJson(Map<String, dynamic> json) => QuizWordHint(
        word: json['word'] ?? '',
        meaning: json['meaning'] ?? '',
        partOfSpeech: json['partOfSpeech'],
        pronunciation: json['pronunciation'],
        example: json['example'],
      );
}

class QuizGrammarNote {
  final String? title;
  final String? explanation;
  final String? example;
  QuizGrammarNote({this.title, this.explanation, this.example});
  factory QuizGrammarNote.fromJson(Map<String, dynamic> json) =>
      QuizGrammarNote(
        title: json['title'],
        explanation: json['explanation'],
        example: json['example'],
      );
}

class QuizProgress {
  final int sentences;
  final int attempts;
  final int correct;
  final int accuracy;
  /// 'beginner' / 'intermediate' / 'advanced' → mastery snapshot.
  final Map<String, QuizProgressBucket> byDifficulty;

  QuizProgress({
    required this.sentences,
    required this.attempts,
    required this.correct,
    required this.accuracy,
    required this.byDifficulty,
  });

  factory QuizProgress.fromJson(Map<String, dynamic> json) {
    final overall = Map<String, dynamic>.from(json['overall'] ?? {});
    final bd = Map<String, dynamic>.from(json['byDifficulty'] ?? {});
    return QuizProgress(
      sentences: overall['sentences'] ?? 0,
      attempts: overall['attempts'] ?? 0,
      correct: overall['correct'] ?? 0,
      accuracy: overall['accuracy'] ?? 0,
      byDifficulty: bd.map(
        (k, v) => MapEntry(
          k,
          QuizProgressBucket.fromJson(Map<String, dynamic>.from(v)),
        ),
      ),
    );
  }
}

class QuizProgressBucket {
  final int sentences;
  final int attempts;
  final int correct;
  final int mastery;
  QuizProgressBucket({
    required this.sentences,
    required this.attempts,
    required this.correct,
    required this.mastery,
  });
  factory QuizProgressBucket.fromJson(Map<String, dynamic> json) =>
      QuizProgressBucket(
        sentences: json['sentences'] ?? 0,
        attempts: json['attempts'] ?? 0,
        correct: json['correct'] ?? 0,
        mastery: json['mastery'] ?? 0,
      );
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
