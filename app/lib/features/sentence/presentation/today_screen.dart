import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../features/auth/domain/auth_provider.dart';
import '../domain/sentence_provider.dart';
import '../domain/sentence_model.dart';
import '../../tts/tts_service.dart';

class TodayScreen extends ConsumerWidget {
  const TodayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final todayAsync = ref.watch(todaySentenceProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('LingoLoop'),
        actions: [
          IconButton(
            icon: const Icon(Icons.quiz_outlined),
            onPressed: () => context.push('/quiz'),
          ),
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.push('/notification-settings'),
          ),
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: () => context.push('/history'),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authStateProvider.notifier).logout(),
          ),
        ],
      ),
      body: todayAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.error),
              const SizedBox(height: 16),
              Text('문장을 불러올 수 없습니다',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(error.toString(),
                  style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => ref.invalidate(todaySentenceProvider),
                child: const Text('다시 시도'),
              ),
            ],
          ),
        ),
        data: (today) => _TodayContent(today: today),
      ),
    );
  }
}

class _TodayContent extends ConsumerWidget {
  final TodaySentence today;

  const _TodayContent({required this.today});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sentence = today.sentence;

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(todaySentenceProvider),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Date & difficulty badge
            Row(
              children: [
                Text(
                  today.assignedDate,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const Spacer(),
                _DifficultyBadge(difficulty: sentence.difficulty),
              ],
            ),
            const SizedBox(height: 24),

            // Main sentence card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (sentence.situation != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          sentence.situation!,
                          style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    // English text
                    Text(
                      sentence.text,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        height: 1.4,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    // Translation
                    Text(
                      sentence.translation,
                      style: TextStyle(
                        fontSize: 16,
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                    if (sentence.pronunciation != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        sentence.pronunciation!,
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.textHint,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    // TTS button
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () {
                          ref.read(ttsServiceProvider).speak(sentence.text);
                        },
                        icon: const Icon(Icons.volume_up),
                        label: const Text('발음 듣기'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Words section
            if (sentence.words.isNotEmpty) ...[
              Text('단어 해설',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              ...sentence.words.map((word) => _WordCard(word: word)),
              const SizedBox(height: 20),
            ],

            // Grammar section
            if (sentence.grammarNotes.isNotEmpty) ...[
              Text('문법 포인트',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              ...sentence.grammarNotes.map((note) => _GrammarCard(note: note)),
            ],

            const SizedBox(height: 24),

            // Action buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => context.push('/quiz'),
                    icon: const Icon(Icons.quiz_outlined),
                    label: const Text('퀴즈 풀기'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => context.push('/progress'),
                    icon: const Icon(Icons.bar_chart),
                    label: const Text('학습 현황'),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}

class _DifficultyBadge extends StatelessWidget {
  final String difficulty;
  const _DifficultyBadge({required this.difficulty});

  @override
  Widget build(BuildContext context) {
    Color color;
    String label;
    switch (difficulty) {
      case 'beginner':
        color = AppColors.beginner;
        label = '초급';
      case 'intermediate':
        color = AppColors.intermediate;
        label = '중급';
      case 'advanced':
        color = AppColors.advanced;
        label = '고급';
      default:
        color = AppColors.beginner;
        label = difficulty;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
            color: color, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _WordCard extends ConsumerWidget {
  final WordDetail word;
  const _WordCard({required this.word});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Row(
          children: [
            Text(word.word,
                style: const TextStyle(fontWeight: FontWeight.w600)),
            if (word.partOfSpeech != null) ...[
              const SizedBox(width: 8),
              Text(
                word.partOfSpeech!,
                style: TextStyle(
                  fontSize: 11,
                  color: AppColors.textHint,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ],
        ),
        subtitle: Text(word.meaning),
        trailing: IconButton(
          icon: const Icon(Icons.volume_up_outlined, size: 20),
          onPressed: () => ref.read(ttsServiceProvider).speak(word.word),
        ),
      ),
    );
  }
}

class _GrammarCard extends StatelessWidget {
  final GrammarNoteDetail note;
  const _GrammarCard({required this.note});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(note.title,
                style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 15)),
            const SizedBox(height: 8),
            Text(note.explanation,
                style: TextStyle(
                    color: AppColors.textSecondary, fontSize: 14, height: 1.5)),
            if (note.example != null) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  note.example!,
                  style: TextStyle(
                    color: AppColors.primary,
                    fontStyle: FontStyle.italic,
                    fontSize: 13,
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
