import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/cartoon.dart';
import '../domain/auth_provider.dart';
import 'social_login_buttons.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nicknameController = TextEditingController();
  bool _obscurePassword = true;
  bool _agreed = false;
  bool _showAgreeError = false;
  late final _termsTap = TapGestureRecognizer()
    ..onTap = () => _open(AppConstants.termsOfUseUrl);
  late final _privacyTap = TapGestureRecognizer()
    ..onTap = () => _open(AppConstants.privacyPolicyUrl);

  Future<void> _open(String url) async {
    try {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {}
  }

  @override
  void dispose() {
    _termsTap.dispose();
    _privacyTap.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _nicknameController.dispose();
    super.dispose();
  }

  Future<void> _handleRegister() async {
    final formOk = _formKey.currentState!.validate();
    if (!_agreed) setState(() => _showAgreeError = true);
    if (!formOk || !_agreed) return;

    final error = await ref
        .read(authStateProvider.notifier)
        .register(
          email: _emailController.text.trim(),
          password: _passwordController.text,
          nickname: _nicknameController.text.trim().isNotEmpty
              ? _nicknameController.text.trim()
              : null,
        );

    // On success the auth state flips and the router navigates away,
    // disposing this widget — touching `ref` after that is unsafe.
    if (!mounted) return;
    if (error == null) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(duration: const Duration(milliseconds: 2200), 
        content: Text(error),
        backgroundColor: AppColors.error,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final isLoading = authState.isLoading;

    return Scaffold(
      // Transparent — MaterialApp.builder already paints the page
      // gradient across the whole window. See login_screen.dart for
      // the rationale.
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          onPressed: () => context.go('/login'),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
                Text('회원가입', style: Theme.of(context).textTheme.headlineLarge),
                const SizedBox(height: 8),
                Text(
                  '하루 한 문장을 생활 속에 자주 마주치는 루프를 시작합니다.',
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 20),
                CartoonCard(
                    padding: const EdgeInsets.all(24),
                    radius: 28,
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          TextFormField(
                            controller: _nicknameController,
                            maxLength: 40,
                            autofillHints: const [AutofillHints.nickname],
                            decoration: const InputDecoration(
                              hintText: '닉네임 (선택)',
                              counterText: '',
                              prefixIcon: Icon(Icons.person_outline),
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            autofillHints: const [AutofillHints.email],
                            decoration: const InputDecoration(
                              hintText: '이메일',
                              prefixIcon: Icon(Icons.email_outlined),
                            ),
                            validator: (v) {
                              if (v == null || v.trim().isEmpty) {
                                return '이메일을 입력하세요';
                              }
                              final ok = RegExp(
                                r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                              ).hasMatch(v.trim());
                              if (!ok) return '올바른 이메일 형식이 아닙니다';
                              return null;
                            },
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            autofillHints: const [AutofillHints.newPassword],
                            decoration: InputDecoration(
                              hintText: '비밀번호 (6자 이상)',
                              prefixIcon: const Icon(Icons.lock_outline),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_off
                                      : Icons.visibility,
                                ),
                                onPressed: () => setState(
                                  () => _obscurePassword = !_obscurePassword,
                                ),
                              ),
                            ),
                            validator: (v) {
                              if (v == null || v.isEmpty) return '비밀번호를 입력하세요';
                              if (v.length < 6) return '비밀번호는 6자 이상이어야 합니다';
                              return null;
                            },
                          ),
                          const SizedBox(height: 20),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceLight,
                              borderRadius: BorderRadius.circular(18),
                            ),
                            child: Text(
                              '무료 플랜은 하루 한 줄 반복 학습, 프리미엄은 문장 퀴즈와 더 촘촘한 반복 루프까지 확장됩니다.',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ),
                          const SizedBox(height: 12),
                          InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () => setState(() {
                              _agreed = !_agreed;
                              _showAgreeError = false;
                            }),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Checkbox(
                                  value: _agreed,
                                  onChanged: (v) => setState(() {
                                    _agreed = v ?? false;
                                    _showAgreeError = false;
                                  }),
                                ),
                                Expanded(
                                  child: Padding(
                                    padding: const EdgeInsets.only(top: 12),
                                    child: Text.rich(
                                      TextSpan(
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodyMedium,
                                        children: [
                                          TextSpan(
                                            text: '이용약관',
                                            recognizer: _termsTap,
                                            style: TextStyle(
                                              color: AppColors.primary,
                                              decoration:
                                                  TextDecoration.underline,
                                            ),
                                          ),
                                          const TextSpan(text: ' 및 '),
                                          TextSpan(
                                            text: '개인정보 처리방침',
                                            recognizer: _privacyTap,
                                            style: TextStyle(
                                              color: AppColors.primary,
                                              decoration:
                                                  TextDecoration.underline,
                                            ),
                                          ),
                                          const TextSpan(text: '에 동의합니다 (필수)'),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (_showAgreeError)
                            Padding(
                              padding: const EdgeInsets.only(left: 12),
                              child: Text(
                                '약관에 동의해야 가입할 수 있어요.',
                                style: TextStyle(
                                  color: AppColors.error,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          const SizedBox(height: 12),
                          ElevatedButton(
                            onPressed: isLoading ? null : _handleRegister,
                            child: isLoading
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Text('가입하고 시작하기'),
                          ),
                          const SizedBox(height: 12),
                          Center(
                            child: TextButton(
                              onPressed: () => context.go('/login'),
                              child: const Text('이미 계정이 있다면 로그인'),
                            ),
                          ),
                          const SizedBox(height: 16),
                          const SocialLoginButtons(),
                        ],
                      ),
                    ),
                ),
              ],
            ),
          ),
        ),
    );
  }
}
