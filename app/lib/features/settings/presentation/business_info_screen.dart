import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_colors.dart';

/// 사업자 정보 고지 화면 (전자상거래법 제13조 신원정보 표시).
/// 한국가상융합디지털산업협회 모바일콘텐츠 제공사업자 고지 요건 대응 —
/// 개발사 전화번호/이메일/사업자 정보를 앱 내에서 확인 가능하게 노출.
/// 값은 [AppConstants]에서 관리(약관 docs/terms-of-use-ko.md와 동일).
class BusinessInfoScreen extends StatelessWidget {
  const BusinessInfoScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('사업자 정보')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(
                children: [
                  _InfoRow(label: '상호', value: AppConstants.bizName),
                  _InfoRow(label: '대표자', value: AppConstants.bizOwner),
                  _InfoRow(
                    label: '사업자등록번호',
                    value: AppConstants.bizRegistrationNo,
                  ),
                  _InfoRow(
                    label: '통신판매업신고',
                    value: AppConstants.bizMailOrderNo,
                  ),
                  _InfoRow(label: '사업장 주소', value: AppConstants.bizAddress),
                  _InfoRow(
                    label: '전화',
                    value: AppConstants.bizPhone,
                    onTap: () => _launch('tel:${AppConstants.bizPhone}'),
                    actionIcon: Icons.call_rounded,
                  ),
                  _InfoRow(
                    label: '이메일',
                    value: AppConstants.bizEmail,
                    onTap: () => _launch('mailto:${AppConstants.bizEmail}'),
                    actionIcon: Icons.mail_outline_rounded,
                    isLast: true,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            '결제 금액은 부가가치세(VAT)가 포함된 금액입니다.\n'
            '구매 후 7일 이내, 콘텐츠를 사용하지 않은 경우 청약철회가 가능하며, '
            '자세한 방법은 구독 화면의 "구독 안내"에서 확인할 수 있습니다.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
          ),
        ],
      ),
    );
  }

  Future<void> _launch(String url) async {
    final uri = Uri.parse(url);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback? onTap;
  final IconData? actionIcon;
  final bool isLast;

  const _InfoRow({
    required this.label,
    required this.value,
    this.onTap,
    this.actionIcon,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        InkWell(
          onTap: onTap,
          // 탭이 없는 행도 길게 눌러 복사 가능 — 사업자등록번호 등.
          onLongPress: () {
            Clipboard.setData(ClipboardData(text: value));
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('$label 복사됨')),
            );
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 96,
                  child: Text(
                    label,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(value, style: theme.textTheme.bodyMedium),
                ),
                if (actionIcon != null) ...[
                  const SizedBox(width: 8),
                  Icon(actionIcon, size: 18, color: AppColors.primary),
                ],
              ],
            ),
          ),
        ),
        if (!isLast)
          Divider(height: 1, color: AppColors.surfaceLight),
      ],
    );
  }
}
