part of 'quiz_screen.dart';

class _PromptCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final Widget child;

  const _PromptCard({
    required this.title,
    required this.subtitle,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return CartoonCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

class _SentenceBox extends StatelessWidget {
  final String primary;
  final String? secondary;

  const _SentenceBox({required this.primary, this.secondary});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(primary, style: Theme.of(context).textTheme.titleLarge),
          if (secondary != null) ...[
            const SizedBox(height: 10),
            Text(
              secondary!,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}

class _HintBanner extends StatelessWidget {
  final String text;

  const _HintBanner({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.accent,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: AppColors.primaryDark,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _AnswerBanner extends StatelessWidget {
  final String text;

  const _AnswerBanner({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: AppColors.success,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _TypePill extends StatelessWidget {
  final String label;

  const _TypePill({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.accent,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: AppColors.primaryDark,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// Difficulty pill rendered alongside the type pill above each quiz.
/// Color codes match the rest of the app's difficulty palette so the
/// user gets a quick "오 이건 고급이네" cue without reading.
class _DifficultyBadge extends StatelessWidget {
  final String level;
  const _DifficultyBadge({required this.level});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (level) {
      'beginner' => ('초급', AppColors.success),
      'intermediate' => ('중급', AppColors.warning),
      'advanced' => ('고급', AppColors.error),
      _ => (level, AppColors.textSecondary),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.45), width: 1),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// Post-attempt explanation card. Surfaces the full sentence, the
/// Korean translation, every word with its meaning + example, and
/// any grammar notes the content team attached. Stays open until the
/// user moves to the next question — they can scroll it freely.
class _ExplanationPanel extends StatelessWidget {
  final QuizExplanation explanation;
  final bool isCorrect;
  const _ExplanationPanel({required this.explanation, required this.isCorrect});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tintColor = isCorrect ? AppColors.success : AppColors.error;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  isCorrect
                      ? Icons.check_circle_rounded
                      : Icons.lightbulb_outline_rounded,
                  color: tintColor,
                ),
                const SizedBox(width: 8),
                Text(
                  isCorrect ? '잘했어요. 한 번 더 짚고 가기' : '정답과 짚고 가기',
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: tintColor,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (explanation.fullSentence != null) ...[
              Text(
                explanation.fullSentence!,
                style: theme.textTheme.titleLarge,
              ),
              if (explanation.pronunciation != null) ...[
                const SizedBox(height: 4),
                Text(
                  explanation.pronunciation!,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
              if (explanation.translation != null) ...[
                const SizedBox(height: 6),
                Text(
                  explanation.translation!,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ],
            if (explanation.words.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text(
                '주요 단어',
                style: theme.textTheme.titleSmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              ...explanation.words
                  .take(6)
                  .map(
                    (w) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: _WordHintRow(hint: w),
                    ),
                  ),
            ],
            if (explanation.grammarNotes.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                '문법 포인트',
                style: theme.textTheme.titleSmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              ...explanation.grammarNotes.map(
                (g) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _GrammarNoteRow(note: g),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _WordHintRow extends StatelessWidget {
  final QuizWordHint hint;
  const _WordHintRow({required this.hint});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 96,
          child: Text(
            hint.word,
            style: theme.textTheme.bodyLarge?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(hint.meaning, style: theme.textTheme.bodyMedium),
              if (hint.example != null && hint.example!.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  hint.example!,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// Tap-to-play card for the listening quiz. Big speaker button +
/// "다시 듣기" hint. Auto-plays once on first mount so the user can
/// jump straight to the answer if they recognise the word.
/// Two-hint row for the new word/sentence typing quizzes — 듣기
/// triggers TTS, 보기 toggles the visual mask card below. Either hint
/// can be missing (e.g., a quiz without visual mask shows only 듣기).
class _HintBar extends ConsumerWidget {
  final String? audioText;
  final String? visualHint;
  final VoidCallback? onToggleVisual;
  final bool isVisualOn;

  const _HintBar({
    required this.audioText,
    required this.visualHint,
    required this.onToggleVisual,
    required this.isVisualOn,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final buttons = <Widget>[];
    if (audioText != null && audioText!.isNotEmpty) {
      // 학습 언어에 맞는 TTS locale 사용. 이전엔 language 인자 누락으로
      // FlutterTts가 en-US 기본값으로 일본어를 영어 음성으로 읽었음.
      final langCode =
          ref.watch(authStateProvider).asData?.value?.targetLanguage;
      buttons.add(
        OutlinedButton.icon(
          onPressed: () => ref
              .read(ttsServiceProvider)
              .speak(audioText!, language: ttsLocaleForCode(langCode)),
          icon: const Icon(Icons.volume_up_rounded, size: 18),
          label: const Text('듣기'),
        ),
      );
    }
    if (onToggleVisual != null) {
      buttons.add(
        OutlinedButton.icon(
          onPressed: onToggleVisual,
          icon: Icon(
            isVisualOn
                ? Icons.visibility_off_outlined
                : Icons.visibility_outlined,
            size: 18,
          ),
          label: Text(isVisualOn ? '숨기기' : '보기'),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (buttons.isNotEmpty)
          // Wrap sizes children to their intrinsic widths even when the
          // parent passes loose horizontal constraints, so OutlinedButtons
          // don't hit the `BoxConstraints forces an infinite width`
          // assertion that Row triggers in this layout context.
          Wrap(spacing: 8, runSpacing: 8, children: buttons),
        if (isVisualOn && visualHint != null && visualHint!.isNotEmpty) ...[
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.accent,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              visualHint!,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontFamily: 'monospace',
                color: AppColors.primaryDark,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _ListeningPrompt extends ConsumerStatefulWidget {
  final String word;

  /// Set non-null after the user has answered — reveals the spelling
  /// so they can compare what they heard with how the word is
  /// written.
  final String? revealedWord;

  const _ListeningPrompt({required this.word, this.revealedWord});

  @override
  ConsumerState<_ListeningPrompt> createState() => _ListeningPromptState();
}

class _ListeningPromptState extends ConsumerState<_ListeningPrompt> {
  bool _autoPlayed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_autoPlayed) {
      _autoPlayed = true;
      // Defer so the first frame can render before TTS starts —
      // also gives the iOS audio session a moment to switch into
      // playback category.
      Future.microtask(_play);
    }
  }

  /// 같은 State가 다음 듣기 문제에 재사용되므로(키 없음) 단어가 바뀌면
  /// 다시 자동 재생한다. 이전엔 첫 문제에서만 재생됐다.
  @override
  void didUpdateWidget(covariant _ListeningPrompt oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.word != widget.word) {
      Future.microtask(_play);
    }
  }

  Future<void> _play() async {
    if (!mounted) return;
    final tts = ref.read(ttsServiceProvider);
    // 학습 언어 locale로 발음. JA 학습자가 영어 voice로 들리는 버그 fix.
    final langCode =
        ref.read(authStateProvider).asData?.value?.targetLanguage;
    try {
      await tts.speak(widget.word, language: ttsLocaleForCode(langCode));
    } catch (_) {
      // 자동 재생 실패는 조용히 — 수동 재생 버튼으로 다시 시도 가능.
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final revealed = widget.revealedWord;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            ElevatedButton.icon(
              onPressed: _play,
              icon: const Icon(Icons.volume_up_rounded, size: 32),
              label: const Text('다시 듣기'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 28,
                  vertical: 18,
                ),
                textStyle: theme.textTheme.titleMedium,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              '발음을 듣고 어떤 단어인지 떠올려보세요.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            if (revealed != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  revealed,
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: AppColors.primaryDark,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _GrammarNoteRow extends StatelessWidget {
  final QuizGrammarNote note;
  const _GrammarNoteRow({required this.note});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (note.title != null && note.title!.isNotEmpty)
            Text(
              note.title!,
              style: theme.textTheme.titleSmall?.copyWith(
                color: AppColors.primary,
              ),
            ),
          if (note.explanation != null && note.explanation!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(note.explanation!, style: theme.textTheme.bodyMedium),
          ],
          if (note.example != null && note.example!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              note.example!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
