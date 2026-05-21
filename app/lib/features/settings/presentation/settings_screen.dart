import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/theme_mode_provider.dart';
import '../../auth/data/social_auth_service.dart';
import '../../auth/domain/auth_provider.dart';
import '../../progress/domain/progress_provider.dart';
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
    final themeMode = ref.watch(themeModeProvider);

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
            icon: Icons.flag_rounded,
            title: '일일 목표',
            subtitle: '하루 ${user?.dailyGoal ?? 3}문장',
            onTap: () =>
                _editDailyGoal(context, ref, user?.dailyGoal ?? 3),
          ),
          _MenuTile(
            icon: Icons.notifications_active_rounded,
            title: '알림 설정',
            subtitle: '푸시 주기 · 활성 시간대',
            onTap: () => context.push('/notification-settings'),
          ),
          _MenuTile(
            icon: themeMode == ThemeMode.dark
                ? Icons.dark_mode_rounded
                : themeMode == ThemeMode.light
                ? Icons.light_mode_rounded
                : Icons.brightness_auto_rounded,
            title: '화면 테마',
            subtitle: _themeModeLabel(themeMode),
            onTap: () => _pickTheme(context, ref, themeMode),
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
          const SizedBox(height: 12),
          TextButton(
            onPressed: () => _deleteAccount(context, ref),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.textHint,
              padding: const EdgeInsets.symmetric(vertical: 6),
            ),
            child: Text(
              '회원 탈퇴',
              style: TextStyle(
                color: AppColors.textHint,
                decoration: TextDecoration.underline,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteAccount(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('회원 탈퇴'),
        content: const Text(
          '계정과 함께 학습 기록·단어장·구독 정보·푸시 설정이 모두 영구 삭제됩니다.\n'
          '되돌릴 수 없어요. 정말 진행할까요?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('탈퇴'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    if (!context.mounted) return;

    final confirmed2 = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('마지막 확인'),
        content: const Text('정말 탈퇴할까요?\n복구할 수 없습니다.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('탈퇴 진행'),
          ),
        ],
      ),
    );
    if (confirmed2 != true) return;

    final error = await ref.read(authStateProvider.notifier).deleteAccount();
    if (!context.mounted) return;
    if (error != null) {
      // Server-side guard: an active store subscription would keep
      // charging the user post-delete (Apple/Play can't cancel from
      // our server). Show the server's message in a dialog and let
      // the user force-confirm only if they really mean to leave the
      // sub running.
      if (error.contains('iOS 설정') || error.contains('Play 스토어')) {
        final forceConfirmed = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('구독이 아직 활성 상태예요'),
            content: Text(error),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('스토어에서 먼저 취소'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                style: TextButton.styleFrom(foregroundColor: AppColors.error),
                child: const Text('그래도 탈퇴'),
              ),
            ],
          ),
        );
        if (forceConfirmed != true || !context.mounted) return;
        final retryError = await ref
            .read(authStateProvider.notifier)
            .deleteAccount(force: true);
        if (!context.mounted) return;
        if (retryError != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(retryError),
              backgroundColor: AppColors.error,
            ),
          );
        }
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }
    // logout() inside deleteAccount cleared local tokens; the router's
    // redirect chain will bounce to /login on the next frame.
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

  Future<void> _editDailyGoal(
    BuildContext context,
    WidgetRef ref,
    int current,
  ) async {
    int value = current.clamp(1, 50);
    final result = await showDialog<int>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('일일 목표'),
          content: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                onPressed: value > 1
                    ? () => setLocal(() => value--)
                    : null,
                icon: const Icon(Icons.remove_circle_outline_rounded),
              ),
              Text(
                '하루 $value문장',
                style: Theme.of(ctx).textTheme.titleLarge,
              ),
              IconButton(
                onPressed: value < 50
                    ? () => setLocal(() => value++)
                    : null,
                icon: const Icon(Icons.add_circle_outline_rounded),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('취소'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, value),
              child: const Text('저장'),
            ),
          ],
        ),
      ),
    );

    if (result != null && result != current) {
      final error = await ref
          .read(authStateProvider.notifier)
          .updateProfile(dailyGoal: result);
      ref.invalidate(heatmapProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error ?? '일일 목표를 하루 $result문장으로 바꿨어요.'),
            backgroundColor: error == null ? null : AppColors.error,
          ),
        );
      }
    }
  }

  String _themeModeLabel(ThemeMode mode) {
    switch (mode) {
      case ThemeMode.light:
        return '라이트 모드';
      case ThemeMode.dark:
        return '다크 모드';
      case ThemeMode.system:
        return '시스템 설정 따름';
    }
  }

  Future<void> _pickTheme(
    BuildContext context,
    WidgetRef ref,
    ThemeMode current,
  ) async {
    final selected = await showModalBottomSheet<ThemeMode>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Text('화면 테마', style: Theme.of(ctx).textTheme.titleMedium),
            const SizedBox(height: 8),
            for (final mode in ThemeMode.values)
              ListTile(
                onTap: () => Navigator.pop(ctx, mode),
                leading: Icon(
                  mode == ThemeMode.dark
                      ? Icons.dark_mode_rounded
                      : mode == ThemeMode.light
                      ? Icons.light_mode_rounded
                      : Icons.brightness_auto_rounded,
                ),
                title: Text(_themeModeLabel(mode)),
                trailing: mode == current
                    ? Icon(Icons.check_rounded, color: AppColors.primary)
                    : null,
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (selected != null && selected != current) {
      await ref.read(themeModeProvider.notifier).set(selected);
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
            child: Icon(
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
                      ? Icon(
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
