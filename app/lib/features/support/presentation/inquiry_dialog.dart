import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/error_message.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/cartoon.dart';
import '../data/inquiry_repository.dart';
import 'inquiry_list_screen.dart' show myInquiriesProvider;

Future<void> showInquiryDialog(
  BuildContext context,
  WidgetRef ref, {
  String category = 'general',
  String? initialMessage,
}) {
  return showDialog<void>(
    context: context,
    builder: (_) =>
        _InquiryDialog(category: category, initialMessage: initialMessage),
  );
}

class _InquiryDialog extends ConsumerStatefulWidget {
  final String category;
  final String? initialMessage;

  const _InquiryDialog({required this.category, this.initialMessage});

  @override
  ConsumerState<_InquiryDialog> createState() => _InquiryDialogState();
}

class _InquiryDialogState extends ConsumerState<_InquiryDialog> {
  static const _maxLength = 2000; // 서버 CreateInquiryDto.message MaxLength와 동일
  static const _minLength = 2;

  late final TextEditingController _messageController;
  late String _category = widget.category;
  bool _isSubmitting = false;

  /// 단어 요청은 호출한 화면이 문맥을 채워 보내므로 카테고리를 바꾸지 못하게 고정.
  bool get _categoryLocked => widget.category == 'word_request';

  @override
  void initState() {
    super.initState();
    _messageController = TextEditingController(text: widget.initialMessage);
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final message = _messageController.text.trim();
    if (message.length < _minLength) return;

    setState(() => _isSubmitting = true);
    try {
      // email은 안 보냄 — 서버가 user.email로 자동 채움. 답변은
      // 앱 푸시 + "내 문의 내역" 화면으로 도착 (메일 발송 채널 없음).
      await ref
          .read(inquiryRepositoryProvider)
          .create(category: _category, message: message);
      // 새 문의를 곧바로 /inquiries 리스트에 반영 — invalidate 없으면
      // 사용자가 "내 문의 내역" 들어가도 캐시 때문에 방금 보낸 게
      // 안 뜸. settings의 배지 카운트도 함께 동기화됨.
      ref.invalidate(myInquiriesProvider);
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('문의가 접수됐어요. 확인 후 답변드릴게요.')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(friendlyErrorMessage(e, fallback: '문의 접수에 실패했어요.')),
        ),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  String get _title => switch (_category) {
    'subscription' => '구독 문의하기',
    'word_request' => '단어 요청하기',
    _ => '문의하기',
  };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final length = _messageController.text.trim().length;
    final canSubmit = !_isSubmitting && length >= _minLength;
    return AlertDialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      title: Row(
        children: [
          const Mascot(mood: MascotMood.think, size: 44),
          const SizedBox(width: 12),
          Expanded(child: Text(_title)),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!_categoryLocked) ...[
              Wrap(
                spacing: 8,
                children: [
                  for (final (value, label) in const [
                    ('general', '일반 문의'),
                    ('subscription', '구독·결제'),
                  ])
                    ChoiceChip(
                      label: Text(label),
                      selected: _category == value,
                      onSelected: _isSubmitting
                          ? null
                          : (_) => setState(() => _category = value),
                    ),
                ],
              ),
              const SizedBox(height: 14),
            ],
            TextField(
              controller: _messageController,
              minLines: 5,
              maxLines: 8,
              maxLength: _maxLength,
              autofocus: true,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                labelText: '문의 내용',
                hintText: '겪고 있는 문제나 궁금한 점을 적어주세요.',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 6),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.notifications_active_outlined,
                  size: 16,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    '답변은 앱 알림과 "내 문의 내역" 화면으로 도착해요.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
            if (length < _minLength && _messageController.text.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                '$_minLength자 이상 적어 주세요.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.error,
                ),
              ),
            ],
          ],
        ),
      ),
      actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
      actions: [
        TextButton(
          onPressed: _isSubmitting ? null : () => Navigator.pop(context),
          child: const Text('취소'),
        ),
        ElevatedButton(
          onPressed: canSubmit ? _submit : null,
          // 테마의 기본 버튼은 가로 전체·56dp라 다이얼로그 액션에는 크다.
          style: ElevatedButton.styleFrom(minimumSize: const Size(96, 46)),
          child: _isSubmitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('보내기'),
        ),
      ],
    );
  }
}
