import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_colors.dart';

/// FAQ-style page covering the common subscription gotchas — primarily
/// the "한 Apple ID = 한 LingoLoop premium" policy that confuses users
/// who run two LingoLoop accounts on one device. Linked from the
/// subscription screen so the error message can point here for detail.
class SubscriptionHelpScreen extends StatelessWidget {
  const SubscriptionHelpScreen({super.key});

  String get _storeLabel => Platform.isIOS ? 'Apple' : 'Google Play';

  Future<void> _openFamilySharing() async {
    final url = Platform.isIOS
        ? 'https://support.apple.com/ko-kr/HT201088'
        : 'https://support.google.com/googleplay/answer/7007852';
    final uri = Uri.parse(url);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('구독 안내')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
        children: [
          _Section(
            icon: Icons.lightbulb_outline_rounded,
            title: '한 결제 계정 = 한 LingoLoop premium',
            body:
                '한 $_storeLabel ${Platform.isIOS ? 'ID' : '계정'}으로는 LingoLoop 한 계정에만 premium을 적용할 수 있어요. '
                '$_storeLabel ${Platform.isIOS ? '' : ''} 정책상 같은 결제 계정으로 같은 상품을 두 번 결제할 수 없기 때문이에요. '
                'LingoLoop 계정이 여러 개라도 결제는 하나만 인식돼요.',
          ),
          _Section(
            icon: Icons.swap_horiz_rounded,
            title: '다른 LingoLoop 계정으로 옮기고 싶어요',
            body: '두 단계예요:\n\n'
                '1) 지금 premium인 계정으로 로그인 → 구독 화면 → "구독 취소 (자동갱신 해지)" → 만료일까지 그대로 사용 가능.\n'
                '2) 만료일 지난 후, 옮기고 싶은 새 계정으로 로그인해서 다시 구독하기.\n\n'
                '만료 후엔 자동으로 새 계정에 link가 옮겨져요.',
          ),
          _Section(
            icon: Icons.group_outlined,
            title: '가족이 같이 쓰고 싶어요',
            body: '$_storeLabel ${Platform.isIOS ? 'Family Sharing' : '가족 그룹'}을 활용하면 '
                '한 명만 결제하고 가족 구성원이 각자 자기 ${Platform.isIOS ? 'Apple ID' : 'Google 계정'}으로 같은 구독을 받을 수 있어요. '
                '단, 현재 LingoLoop은 가족 공유로 받은 구독을 자동 인식하지 못해 추가 작업이 필요할 수 있어요.',
            footer: TextButton.icon(
              onPressed: _openFamilySharing,
              icon: const Icon(Icons.open_in_new_rounded, size: 18),
              label: Text(
                Platform.isIOS ? 'Apple Family Sharing 안내' : 'Google 가족 그룹 안내',
              ),
            ),
          ),
          _Section(
            icon: Icons.help_outline_rounded,
            title: '환불 받고 싶어요',
            body:
                '환불은 $_storeLabel에서 직접 처리해요. 구독 화면의 "환불을 원하시면" 버튼으로 안내 페이지로 갈 수 있어요. '
                '환불이 승인되면 자동으로 free 플랜으로 전환돼요 (별도 작업 불필요).',
          ),
          _Section(
            icon: Icons.refresh_rounded,
            title: '구독했는데 premium이 안 보여요',
            body: '대부분 다음 두 가지 중 하나예요:\n\n'
                '• 구매 직후 잠시 동기화 시간이 걸려요. 1~2분 후 앱을 다시 열어보세요.\n'
                '• 또는 구독 화면 하단의 "구매 복원" 버튼을 눌러주세요.\n\n'
                '그래도 안 되면 같은 $_storeLabel ${Platform.isIOS ? 'ID' : '계정'}으로 다른 LingoLoop 계정에 구독이 연결돼 있을 수 있어요 — '
                '맨 위 안내를 참고해 주세요.',
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final IconData icon;
  final String title;
  final String body;
  final Widget? footer;

  const _Section({
    required this.icon,
    required this.title,
    required this.body,
    this.footer,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, color: AppColors.primary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      title,
                      style: theme.textTheme.titleMedium,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                body,
                style: theme.textTheme.bodyMedium?.copyWith(height: 1.5),
              ),
              if (footer != null) ...[
                const SizedBox(height: 8),
                footer!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}
