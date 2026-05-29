import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../auth/domain/auth_provider.dart';
import '../../support/presentation/inquiry_dialog.dart';
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
      // 시트를 root navigator에 올려 bottom nav 위까지 cover. 동시에
      // 탭 전환 시 AppShell이 root에서 popup만 pop해 자동 dismiss 가능.
      useRootNavigator: true,
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
          // 네트워크/서버 에러와 "사전 미생성"은 사용자 입장에서 같은
          // 경험으로 통일 — 둘 다 "아직 등록된 사전이 없어요" + 업데이트
          // 요청 문의 동선. 진짜 transient 에러도 다음에 다시 들어오면
          // 시도되니까 영구 실패로 표시할 이유 없음.
          error: (_, _) => _NotRegistered(word: word),
          data: (detail) {
            if (detail == null) return _NotRegistered(word: word);
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
        const SizedBox(height: 8),
        _ReportButton(baseWord: detail.baseWord),
        const SizedBox(height: 8),
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
    // priority dedup — VERB/ADJ 둘 다 'base' 포함이라 spread 시 중복.
    // Set으로 한 번 거르면 같은 키가 두 번 ordered에 들어가는 버그 방지.
    final priority = {...verbOrder, ...nounOrder, ...adjOrder}.toList();
    final have = keys.toSet();
    final ordered = priority.where(have.contains).toList();
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

/// 등록된 사전 내용이 어색하거나 오류일 때 사용자가 직접 신고하는
/// 버튼. inquiry dialog를 word_request 카테고리로 prefill해서 띄움 —
/// "어떤 부분이 이상한지 알려주세요" 안내로 자유 입력 유도.
class _ReportButton extends ConsumerWidget {
  final String baseWord;
  const _ReportButton({required this.baseWord});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return OutlinedButton.icon(
      onPressed: () {
        Navigator.of(context).pop();
        showInquiryDialog(
          context,
          ref,
          category: 'word_request',
          // 카테고리는 같지만 prefill로 운영자가 "신규 단어 요청" vs
          // "기존 단어 수정 요청"을 구분 가능. 사용자에겐 빈 줄 + 안내문
          // 을 보여줘 어디부터 적을지 알려줌.
          initialMessage:
              '"$baseWord" 단어 정보에 이상한 부분이 있어요.\n\n'
              '(어떤 부분이 어떻게 이상한지 적어주세요 — 뜻/활용형/예문 등)\n',
        );
      },
      icon: const Icon(Icons.report_outlined, size: 18),
      label: const Text('내용이 이상해요'),
    );
  }
}

/// 단어 사전이 아직 등록되지 않았을 때(또는 fetch 실패 시) 보여주는
/// 상태. 사용자 입장에서 단어를 빨리 채워달라는 동선까지 자연스럽게
/// 연결 — '문의하기' 버튼이 inquiry dialog를 해당 단어로 prefill해 띄움.
class _NotRegistered extends ConsumerWidget {
  final String word;
  const _NotRegistered({required this.word});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.menu_book_outlined,
            size: 48,
            color: AppColors.textSecondary,
          ),
          const SizedBox(height: 12),
          Text(
            '아직 등록된 사전이 없어요',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 6),
          Text(
            '1~2일 내에 업데이트됩니다.',
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          // ElevatedButton 글로벌 theme이 minimumSize: Size(double.infinity, 56)
          // 이라 Row 안에 넣으면 무한 width 요구로 layout crash. 빈 상태
          // 화면이라 세로로 쌓는 게 visual 안정성도 더 좋음.
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Column(
              children: [
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.of(context).pop();
                    showInquiryDialog(
                      context,
                      ref,
                      category: 'word_request',
                      initialMessage:
                          '"$word" 단어의 활용형/예문 업데이트를 요청합니다.',
                    );
                  },
                  icon: const Icon(Icons.mail_outline_rounded, size: 18),
                  label: const Text('문의하기'),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('닫기'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

