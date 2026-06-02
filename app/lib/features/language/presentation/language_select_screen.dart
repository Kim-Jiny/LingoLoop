import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../auth/domain/auth_provider.dart';
import '../domain/language_selected_provider.dart';
import '../domain/language_tracks_provider.dart';
import '../domain/languages.dart';

/// 학습 언어 선택. 두 가지 사용 맥락:
///
/// 1. 신규 사용자 온보딩 흐름 — 알림 설정 직후 자동 진입. 라우터가
///    `learningTrack == null`이고 stored language tracks이 없으면 이 화면
///    으로 보냄. 선택 후 자동으로 `/track` push.
///
/// 2. 설정 → "학습 언어 변경" — 기존 학습 중인 언어를 다른 언어로 전환.
///    선택 후 새 언어에 stored track이 있으면 홈으로, 없으면 `/track`으로.
class LanguageSelectScreen extends ConsumerStatefulWidget {
  /// 화면 진입 맥락. onboarding flow면 뒤로가기 막고 자동 push.
  final bool fromOnboarding;

  const LanguageSelectScreen({super.key, this.fromOnboarding = false});

  @override
  ConsumerState<LanguageSelectScreen> createState() =>
      _LanguageSelectScreenState();
}

class _LanguageSelectScreenState extends ConsumerState<LanguageSelectScreen> {
  String? _selected;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    // 현재 학습 언어를 pre-select — 재진입 시 사용자가 다시 탭할 필요 없게.
    final user = ref.read(authStateProvider).asData?.value;
    _selected = user?.targetLanguage ?? 'en';
  }

  Future<void> _continue() async {
    if (_saving) return;
    final pick = _selected;
    if (pick == null) return;
    setState(() => _saving = true);
    try {
      // 같은 언어를 다시 골랐어도 명시 호출 — 서버가 멱등 처리하고, 클라
      // 상태 일관성을 위해 강제 refresh.
      final err = await ref
          .read(authStateProvider.notifier)
          .updateProfile(targetLanguage: pick);
      if (!mounted) return;
      if (err != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(err), backgroundColor: AppColors.error),
        );
        return;
      }
      // 명시 선택 사실을 영구화 — 라우터 hasAnyLang 가드가 "트랙 row가
      // 없는데 사용자는 언어를 골랐다"는 상태를 인식할 수 있게. 없으면
      // /track으로 push해도 redirect가 /language로 되돌리는 사이클 발생.
      await ref.read(languageSelectedProvider.notifier).markSelected();
      if (!mounted) return;
      // 선택한 언어에 저장된 트랙이 이미 있으면 홈으로, 없으면 트랙 화면.
      ref.invalidate(languageTracksProvider);
      final tracks = await ref.read(languageTracksProvider.future);
      if (!mounted) return;
      final hasStoredTrack = tracks.any((t) => t.languageCode == pick);
      if (hasStoredTrack) {
        // 새 언어에 이미 트랙이 있음 — 라우터가 알아서 / 로 보냄.
        context.go('/');
      } else {
        context.push('/track');
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: Colors.transparent,
      // 온보딩 흐름이면 시스템 back을 막아 사용자가 빠져나가지 않게.
      // 설정에서 들어온 경우는 AppBar의 leading으로 정상 pop.
      appBar: widget.fromOnboarding
          ? null
          : AppBar(title: const Text('학습 언어 변경')),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.fromOnboarding
                        ? '어떤 언어를 학습할까요?'
                        : '학습 언어를 바꿔보세요',
                    style: theme.textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '문장·단어장·퀴즈가 모두 선택한 언어로 바뀝니다.\n'
                    '구독은 그대로 유지되고, 언제든 다시 바꿀 수 있어요.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                itemBuilder: (_, i) {
                  final lang = supportedLanguages[i];
                  return _LanguageCard(
                    language: lang,
                    selected: _selected == lang.code,
                    onTap: () => setState(() => _selected = lang.code),
                  );
                },
                separatorBuilder: (_, _) => const SizedBox(height: 12),
                itemCount: supportedLanguages.length,
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _saving ? null : _continue,
                  child: Text(_saving ? '저장 중...' : '계속하기'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LanguageCard extends StatelessWidget {
  final LearningLanguage language;
  final bool selected;
  final VoidCallback onTap;

  const _LanguageCard({
    required this.language,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: selected
          ? AppColors.primary.withValues(alpha: 0.08)
          : AppColors.surface,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected ? AppColors.primary : AppColors.cardBorder,
              width: selected ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              // 이모지 글리프 — 컬러 폰트로 모든 OS에서 안정 렌더링.
              Text(language.glyph, style: const TextStyle(fontSize: 36)),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          language.labelKo,
                          style: theme.textTheme.titleMedium,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          language.labelLocal,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      language.description,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              if (selected)
                Icon(
                  Icons.check_circle_rounded,
                  color: AppColors.primary,
                  size: 28,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
