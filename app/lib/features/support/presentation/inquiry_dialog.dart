import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/error_message.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/domain/auth_provider.dart';
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
  late final TextEditingController _messageController;
  late final TextEditingController _emailController;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authStateProvider).asData?.value;
    _messageController = TextEditingController(text: widget.initialMessage);
    _emailController = TextEditingController(text: user?.email ?? '');
  }

  @override
  void dispose() {
    _messageController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final message = _messageController.text.trim();
    if (message.length < 2) return;

    setState(() => _isSubmitting = true);
    try {
      await ref
          .read(inquiryRepositoryProvider)
          .create(
            category: widget.category,
            message: message,
            email: _emailController.text,
          );
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

  @override
  Widget build(BuildContext context) {
    final title = widget.category == 'subscription' ? '구독 문의하기' : '문의하기';
    final canSubmit =
        !_isSubmitting && _messageController.text.trim().length >= 2;
    return AlertDialog(
      title: Text(title),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: '답변 받을 이메일',
                hintText: 'email@example.com',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _messageController,
              minLines: 5,
              maxLines: 8,
              autofocus: true,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                labelText: '문의 내용',
                hintText: '겪고 있는 문제나 궁금한 점을 적어주세요.',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '계정 정보와 함께 관리자 페이지에 전달됩니다.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSubmitting ? null : () => Navigator.pop(context),
          child: const Text('취소'),
        ),
        ElevatedButton(
          onPressed: canSubmit ? _submit : null,
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
