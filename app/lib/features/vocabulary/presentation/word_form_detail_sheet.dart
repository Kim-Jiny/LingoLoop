import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../auth/domain/auth_provider.dart';
import '../../tts/tts_service.dart';
import '../data/vocabulary_repository.dart';
import '../domain/vocabulary_model.dart';

/// 단어장 카드 tap 시 뜨는 사전 상세 시트.
///
/// 화면 구성:
///   - 헤더: baseWord (원형) + 품사/한국어 뜻
///   - 활용형 리스트: 키별로 surface + 영어 예문 + 한국어 번역
///   - 현재 사용자가 본 surface(highlightSurface)에 해당하는 form은
///     하이라이트해 "지금 보고 있는 형태"임을 명확히
///   - 발음 버튼 (각 활용형 / 각 예문)
///
/// 데이터가 없으면(사전 미생성) "사전 정보 없음" 안내 표시.
class WordFormDetailSheet extends ConsumerWidget {
  final String word;
  /// 사용자가 단어장에서 본 표면형. 시트가 어떤 활용형을 highlight할지
  /// 결정 — baseWord와 같을 수도, "ran" 같은 활용형일 수도.
  final String highlightSurface;

  const WordFormDetailSheet({
    super.key,
    required this.word,
    required this.highlightSurface,
  });

  static Future<void> show(
    BuildContext context, {
    required String word,
    required String highlightSurface,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.background,
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => WordFormDetailSheet(
        word: word,
        highlightSurface: highlightSurface,
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_wordFormProvider(word));
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: async.when(
          loading: () => const SizedBox(
            height: 200,
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (e, _) => _Empty(
            title: '사전을 불러오지 못했어요',
            body: '$e',
          ),
          data: (detail) {
            if (detail == null) {
              return _Empty(
                title: '아직 사전 정보가 없어요',
                body: '"$word"의 활용형과 예문은 곧 추가될 예정이에요.',
              );
            }
            return _DetailBody(
              detail: detail,
              highlightSurface: highlightSurface,
            );
          },
        ),
      ),
    );
  }
}

final _wordFormProvider =
    FutureProvider.family<WordFormDetail?, String>((ref, word) async {
  final repo = ref.read(vocabularyRepositoryProvider);
  return repo.getWordForms(word);
});

class _DetailBody extends ConsumerWidget {
  final WordFormDetail detail;
  final String highlightSurface;

  const _DetailBody({
    required this.detail,
    required this.highlightSurface,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final highlightLc = highlightSurface.toLowerCase();
    // forms key 우선순위 — verb 표준 순서로 안 맞으면 그냥 입력 순서.
    final orderedKeys = _orderFormKeys(detail.forms.keys.toList());

    return ListView(
      shrinkWrap: true,
      children: [
        Center(
          child: Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: AppColors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    detail.baseWord,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      _Pill(text: _posLabel(detail.partOfSpeech)),
                      if (detail.meaning != null &&
                          detail.meaning!.trim().isNotEmpty)
                        Text(
                          detail.meaning!,
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                    ],
                  ),
                ],
              ),
            ),
            _SpeakButton(text: detail.baseWord),
          ],
        ),
        const SizedBox(height: 16),
        const Divider(height: 1),
        const SizedBox(height: 12),
        Text('활용형', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        for (final key in orderedKeys)
          _FormRow(
            formKey: key,
            surface: detail.forms[key] ?? '',
            example: detail.examples[key],
            highlighted: (detail.forms[key] ?? '').toLowerCase() == highlightLc,
          ),
      ],
    );
  }

  List<String> _orderFormKeys(List<String> keys) {
    const verbOrder = [
      'base',
      'thirdPersonSingular',
      'past',
      'pastParticiple',
      'presentParticiple',
    ];
    const nounOrder = ['singular', 'plural'];
    const adjOrder = ['base', 'comparative', 'superlative'];
    final priority = [...verbOrder, ...nounOrder, ...adjOrder];
    final set = keys.toSet();
    final ordered = priority.where(set.contains).toList();
    final extras = keys.where((k) => !priority.contains(k)).toList();
    return [...ordered, ...extras];
  }

  String _posLabel(String pos) {
    switch (pos) {
      case 'verb':
        return '동사';
      case 'noun':
        return '명사';
      case 'adjective':
        return '형용사';
      case 'adverb':
        return '부사';
      default:
        return '기타';
    }
  }
}

class _FormRow extends StatelessWidget {
  final String formKey;
  final String surface;
  final WordExample? example;
  final bool highlighted;

  const _FormRow({
    required this.formKey,
    required this.surface,
    required this.example,
    required this.highlighted,
  });

  @override
  Widget build(BuildContext context) {
    final label = VocabularyItem.formLabelOf(formKey);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        // 사용자가 본 활용형은 강조 — "지금 보고 있는 형태가 이거예요".
        color: highlighted ? AppColors.accent : AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(16),
        border: highlighted
            ? Border.all(color: AppColors.primary, width: 1.5)
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      surface,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              _SpeakButton(text: surface),
            ],
          ),
          if (example != null) ...[
            const SizedBox(height: 10),
            _ExampleBlock(example: example!),
          ],
        ],
      ),
    );
  }
}

class _ExampleBlock extends StatelessWidget {
  final WordExample example;

  const _ExampleBlock({required this.example});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  example.en,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              _SpeakButton(text: example.en, compact: true),
            ],
          ),
          if (example.ko.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              example.ko,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SpeakButton extends ConsumerWidget {
  final String text;
  final bool compact;

  const _SpeakButton({required this.text, this.compact = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return IconButton(
      tooltip: '발음 듣기',
      onPressed: text.trim().isEmpty
          ? null
          : () => ref.read(ttsServiceProvider).speak(
                text,
                language: _ttsLanguage(
                  ref
                          .read(authStateProvider)
                          .asData
                          ?.value
                          ?.targetLanguage ??
                      'en',
                ),
              ),
      iconSize: compact ? 20 : 24,
      icon: const Icon(Icons.volume_up_outlined),
      style: IconButton.styleFrom(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.primary,
      ),
    );
  }

  String _ttsLanguage(String code) {
    switch (code) {
      case 'ja':
        return 'ja-JP';
      case 'es':
        return 'es-ES';
      case 'ko':
        return 'ko-KR';
      default:
        return 'en-US';
    }
  }
}

class _Pill extends StatelessWidget {
  final String text;
  const _Pill({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: AppColors.primary,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  final String title;
  final String body;
  const _Empty({required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(
            body,
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('닫기'),
          ),
        ],
      ),
    );
  }
}

