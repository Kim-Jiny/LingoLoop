import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/data/social_auth_service.dart';
import '../../auth/domain/auth_provider.dart';
import '../../subscription/domain/subscription_provider.dart';

String _avatarInitial(String? nickname, String? email) {
  final source = (nickname?.trim().isNotEmpty ?? false)
      ? nickname!.trim()
      : (email?.trim().isNotEmpty ?? false)
      ? email!.trim()
      : '?';
  return source.characters.first.toUpperCase();
}

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).asData?.value;
    final subscriptionAsync = ref.watch(subscriptionStatusProvider);
    final isPremium =
        subscriptionAsync.asData?.value.isPremium ?? (user?.isPremium ?? false);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('설정')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppColors.accent,
                    child: Text(
                      _avatarInitial(user?.nickname, user?.email),
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          (user?.nickname?.trim().isNotEmpty ?? false)
                              ? user!.nickname!.trim()
                              : '학습자',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          user?.email ?? '',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: '닉네임 수정',
                    onPressed: () =>
                        _editNickname(context, ref, user?.nickname),
                    icon: const Icon(Icons.edit_outlined),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          _PlanCard(isPremium: isPremium),
          const SizedBox(height: 24),
          Text('환경설정', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          _MenuTile(
            icon: Icons.route_rounded,
            title: '학습 플랜 변경',
            subtitle: '초급·중급·고급·토익·토플·회화',
            onTap: () => context.push('/track'),
          ),
          _MenuTile(
            icon: Icons.notifications_active_rounded,
            title: '알림 설정',
            subtitle: '푸시 주기 · 활성 시간대',
            onTap: () => context.push('/notification-settings'),
          ),
          const SizedBox(height: 24),
          Text('계정 연동', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          const _LinkedAccountsSection(),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () async {
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('로그아웃'),
                  content: const Text('정말 로그아웃할까요?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('취소'),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      child: const Text('로그아웃'),
                    ),
                  ],
                ),
              );
              if (confirmed == true) {
                await ref.read(authStateProvider.notifier).logout();
              }
            },
            icon: const Icon(Icons.logout_rounded),
            label: const Text('로그아웃'),
            style: OutlinedButton.styleFrom(foregroundColor: AppColors.error),
          ),
        ],
      ),
    );
  }

  Future<void> _editNickname(
    BuildContext context,
    WidgetRef ref,
    String? current,
  ) async {
    final controller = TextEditingController(text: current ?? '');
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('닉네임 수정'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(hintText: '닉네임'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('저장'),
          ),
        ],
      ),
    );

    if (result != null && result.isNotEmpty && result != current) {
      final error = await ref
          .read(authStateProvider.notifier)
          .updateProfile(nickname: result);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error ?? '닉네임을 변경했어요.'),
            backgroundColor: error == null ? null : AppColors.error,
          ),
        );
      }
    }
  }
}

class _PlanCard extends StatelessWidget {
  final bool isPremium;

  const _PlanCard({required this.isPremium});

  @override
  Widget build(BuildContext context) {
    final enabled = AppConstants.premiumEnabled;
    final title = !enabled
        ? '프리미엄'
        : isPremium
        ? '프리미엄 이용 중'
        : '무료 플랜';
    final subtitle = !enabled
        ? '준비 중 · 다음 업데이트에서 열려요'
        : isPremium
        ? '구독 관리 및 복원'
        : '프리미엄으로 업그레이드';

    final row = Padding(
      padding: const EdgeInsets.all(18),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.workspace_premium_rounded,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
          if (enabled)
            const Icon(Icons.chevron_right_rounded)
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.textHint.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '준비 중',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textHint,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
        ],
      ),
    );

    if (!enabled) {
      return Opacity(opacity: 0.7, child: Card(child: row));
    }
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => context.push('/subscription'),
        child: row,
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _MenuTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, color: AppColors.primary),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LinkedAccountsSection extends ConsumerWidget {
  const _LinkedAccountsSection();

  static const _labels = {
    'google': 'Google',
    'apple': 'Apple',
    'kakao': '카카오',
  };

  Future<void> _link(
    BuildContext context,
    WidgetRef ref,
    SocialProvider provider,
  ) async {
    final result =
        await ref.read(authStateProvider.notifier).linkSocial(provider);
    if (!context.mounted) return;
    if (result == 'cancelled') return;
    if (result == null) {
      ref.invalidate(identitiesProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('소셜 계정을 연동했어요.')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result), backgroundColor: AppColors.error),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(identitiesProvider);
    final providers = <SocialProvider>[
      SocialProvider.google,
      if (Platform.isIOS) SocialProvider.apple,
      SocialProvider.kakao,
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: async.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(20),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (e, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              '연동 정보를 불러오지 못했어요.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          data: (info) => Column(
            children: [
              for (final p in providers)
                ListTile(
                  leading: Icon(
                    p == SocialProvider.apple
                        ? Icons.apple_rounded
                        : p == SocialProvider.kakao
                        ? Icons.chat_bubble_rounded
                        : Icons.g_mobiledata_rounded,
                    color: AppColors.primary,
                  ),
                  title: Text(_labels[p.name] ?? p.name),
                  subtitle: Text(
                    info.has(p.name)
                        ? (info.identities
                                  .firstWhere((i) => i.provider == p.name)
                                  .email ??
                              '연동됨')
                        : '연동 안 됨',
                  ),
                  trailing: info.has(p.name)
                      ? const Icon(
                          Icons.check_circle_rounded,
                          color: AppColors.success,
                        )
                      : TextButton(
                          onPressed: () => _link(context, ref, p),
                          child: const Text('연동'),
                        ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
