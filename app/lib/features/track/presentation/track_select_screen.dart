import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/domain/auth_provider.dart';
import '../../language/domain/language_tracks_provider.dart';
import '../../language/domain/languages.dart';
import '../domain/learning_tracks.dart';

/// 트랙 선택 화면. 표시 트랙은 현재 학습 언어(`user.targetLanguage`)에
/// 따라 달라짐:
///  · 영어: 초·중·고급 / 토익·토플 / 회화
///  · 일본어: 초·중·고급 / JLPT N5~N1·JPT / 회화
/// 같은 언어 안에서 트랙 그룹(general/exam/conversation)별로 섹션 헤더로
/// 구분 — 10개나 되는 일본어 트랙도 시선 부담이 덜함.
class TrackSelectScreen extends ConsumerStatefulWidget {
  const TrackSelectScreen({super.key});

  @override
  ConsumerState<TrackSelectScreen> createState() => _TrackSelectScreenState();
}

class _TrackSelectScreenState extends ConsumerState<TrackSelectScreen> {
  bool _saving = false;

  Future<void> _choose(String track) async {
    if (_saving) return;
    setState(() => _saving = true);
    final err = await ref
        .read(authStateProvider.notifier)
        .updateProfile(learningTrack: track);
    if (!mounted) return;
    setState(() => _saving = false);
    if (err != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err), backgroundColor: AppColors.error),
      );
      return;
    }
    // 트랙 저장 = 서버에 (user, lang, track) row 생성/갱신 → languageTracks
    // provider도 stale. 다음 라우터 재평가에서 가드 통과하도록.
    ref.invalidate(languageTracksProvider);
    // 설정에서 들어왔으면 pop; first-run gate(없음)이면 홈으로.
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/');
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).asData?.value;
    final langCode = user?.targetLanguage ?? 'en';
    final currentTrack = user?.learningTrack;
    final language = findLanguage(langCode);
    final allTracks = tracksForLanguage(langCode);

    // 그룹별로 묶기 (UI 노출 순서는 enum 선언 순서 = general → exam → conv).
    final grouped = <TrackGroup, List<LearningTrack>>{};
    for (final t in allTracks) {
      grouped.putIfAbsent(t.group, () => <LearningTrack>[]).add(t);
    }

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('학습 플랜')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
        children: [
          // ── 헤더 카드 ─────────────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(26),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFF26B3A), Color(0xFFFFA86E)],
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (language != null) ...[
                      Text(language.glyph, style: const TextStyle(fontSize: 22)),
                      const SizedBox(width: 8),
                    ],
                    Text(
                      language?.labelKo ?? langCode,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  '어떤 플랜으로 학습할까요?',
                  style: Theme.of(context)
                      .textTheme
                      .titleLarge
                      ?.copyWith(color: Colors.white),
                ),
                const SizedBox(height: 8),
                Text(
                  '카드를 탭하면 그 플랜으로 학습이 시작돼요.\n플랜은 설정에서 언제든 바꿀 수 있어요.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.85),
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ── 그룹별 섹션 ───────────────────────────────────────────────────
          for (final group in TrackGroup.values)
            if (grouped[group]?.isNotEmpty ?? false) ...[
              _SectionHeader(label: trackGroupLabel(group)),
              const SizedBox(height: 8),
              ...grouped[group]!.map(
                (t) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _TrackCard(
                    track: t,
                    isCurrent: currentTrack == t.key,
                    disabled: _saving,
                    onTap: () => _choose(t.key),
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],

          if (allTracks.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  '지원되지 않는 언어입니다.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String label;
  const _SectionHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Text(
        label,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _TrackCard extends StatelessWidget {
  final LearningTrack track;
  final bool isCurrent;
  final bool disabled;
  final VoidCallback onTap;

  const _TrackCard({
    required this.track,
    required this.isCurrent,
    required this.disabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: disabled ? 0.6 : 1,
      child: Card(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(
            color: isCurrent
                ? AppColors.primary
                : AppColors.cardBorder,
            width: isCurrent ? 1.6 : 1,
          ),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: disabled ? null : onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(track.icon, color: AppColors.primary),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            track.label,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          if (isCurrent) ...[
                            const SizedBox(width: 8),
                            _Badge('현재', AppColors.success),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        track.description,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                _ChooseCta(highlighted: isCurrent),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 카드 우측에 붙는 "선택 →" CTA pill. 현재 트랙이면 primary 채워서
/// 시각적으로 강조. 탭은 카드 전체에서 받으므로 onPressed 없음.
class _ChooseCta extends StatelessWidget {
  final bool highlighted;
  const _ChooseCta({required this.highlighted});

  @override
  Widget build(BuildContext context) {
    final bg = highlighted ? AppColors.primary : Colors.transparent;
    final fg = highlighted ? Colors.white : AppColors.primary;
    final border = highlighted
        ? AppColors.primary
        : AppColors.primary.withValues(alpha: 0.4);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border, width: 1.2),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            highlighted ? '유지' : '선택',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: fg,
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(width: 2),
          Icon(Icons.arrow_forward_rounded, size: 16, color: fg),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final String text;
  final Color color;
  const _Badge(this.text, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}
