import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../data/social_auth_service.dart';
import '../domain/auth_provider.dart';

/// Google / Apple / Kakao sign-in buttons shared by login & register.
class SocialLoginButtons extends ConsumerStatefulWidget {
  const SocialLoginButtons({super.key});

  @override
  ConsumerState<SocialLoginButtons> createState() =>
      _SocialLoginButtonsState();
}

class _SocialLoginButtonsState extends ConsumerState<SocialLoginButtons> {
  SocialProvider? _busy;

  Future<void> _signIn(SocialProvider provider) async {
    setState(() => _busy = provider);
    try {
      final err =
          await ref.read(authStateProvider.notifier).socialLogin(provider);
      if (!mounted) return;
      if (err != null && err != 'cancelled') {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(err),
            backgroundColor: AppColors.error,
            duration: const Duration(seconds: 6),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final anyBusy = _busy != null;
    return Column(
      children: [
        Row(
          children: [
            const Expanded(child: Divider()),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text(
                '소셜 계정으로 계속하기',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
            const Expanded(child: Divider()),
          ],
        ),
        const SizedBox(height: 16),
        _SocialButton(
          label: 'Google로 계속하기',
          icon: Icons.g_mobiledata_rounded,
          bg: Colors.white,
          fg: AppColors.textPrimary,
          busy: _busy == SocialProvider.google,
          onTap: anyBusy ? null : () => _signIn(SocialProvider.google),
        ),
        if (Platform.isIOS) ...[
          const SizedBox(height: 10),
          _SocialButton(
            label: 'Apple로 계속하기',
            icon: Icons.apple_rounded,
            bg: Colors.black,
            fg: Colors.white,
            busy: _busy == SocialProvider.apple,
            onTap: anyBusy ? null : () => _signIn(SocialProvider.apple),
          ),
        ],
        const SizedBox(height: 10),
        _SocialButton(
          label: '카카오로 계속하기',
          icon: Icons.chat_bubble_rounded,
          bg: const Color(0xFFFEE500),
          fg: const Color(0xFF191600),
          busy: _busy == SocialProvider.kakao,
          onTap: anyBusy ? null : () => _signIn(SocialProvider.kakao),
        ),
      ],
    );
  }
}

class _SocialButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color bg;
  final Color fg;
  final bool busy;
  final VoidCallback? onTap;

  const _SocialButton({
    required this.label,
    required this.icon,
    required this.bg,
    required this.fg,
    required this.busy,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: onTap,
        icon: busy
            ? SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2, color: fg),
              )
            : Icon(icon, color: fg),
        label: Text(label),
        style: ElevatedButton.styleFrom(
          backgroundColor: bg,
          foregroundColor: fg,
          elevation: 0,
          side: BorderSide(color: AppColors.border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(26),
          ),
        ),
      ),
    );
  }
}
