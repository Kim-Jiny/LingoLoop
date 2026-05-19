import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/domain/auth_provider.dart';

class _Track {
  final String key;
  final String title;
  final String desc;
  final IconData icon;
  const _Track(this.key, this.title, this.desc, this.icon);
}

const _tracks = [
  _Track('beginner', '초급', '기초 단어와 짧은 문장부터', Icons.spa_rounded),
  _Track('intermediate', '중급', '일상 표현을 넓혀가는 단계', Icons.trending_up_rounded),
  _Track('advanced', '고급', '자연스럽고 정교한 표현', Icons.workspace_premium_rounded),
  _Track('toeic', '토익(TOEIC)', '비즈니스·실무 시험 대비', Icons.business_center_rounded),
  _Track('toefl', '토플(TOEFL)', '학술 영어·유학 대비', Icons.school_rounded),
  _Track('conversation', '회화', '실전 대화 중심 연습', Icons.forum_rounded),
];

class TrackSelectScreen extends ConsumerStatefulWidget {
  const TrackSelectScreen({super.key});

  @override
  ConsumerState<TrackSelectScreen> createState() => _TrackSelectScreenState();
}

class _TrackSelectScreenState extends ConsumerState<TrackSelectScreen> {
  // null = survey not done yet; otherwise the recommended track key.
  String? _recommended;
  String? _purpose; // 'exam' | 'daily'
  bool _saving = false;

  void _recommend(String track) => setState(() => _recommended = track);

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
    // Opened from settings → pop back; first-run gate (nothing to pop)
    // → go to home now that a track is set.
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/');
    }
  }

  @override
  Widget build(BuildContext context) {
    final current = ref.watch(authStateProvider).asData?.value?.learningTrack;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('학습 플랜')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
        children: [
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
                Text(
                  '어떤 목표로 배우시나요?',
                  style: Theme.of(context).textTheme.titleLarge
                      ?.copyWith(color: Colors.white),
                ),
                const SizedBox(height: 8),
                Text(
                  '간단한 추천을 도와드려요. 플랜은 언제든 바꿀 수 있어요.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.85),
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          // ── Mini survey ────────────────────────────────────────────────
          Text('1. 목적', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _Choice(
                  label: '시험 준비',
                  selected: _purpose == 'exam',
                  onTap: () => setState(() {
                    _purpose = 'exam';
                    _recommended = null;
                  }),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _Choice(
                  label: '일상·회화',
                  selected: _purpose == 'daily',
                  onTap: () => setState(() {
                    _purpose = 'daily';
                    _recommended = null;
                  }),
                ),
              ),
            ],
          ),
          if (_purpose == 'exam') ...[
            const SizedBox(height: 16),
            Text('2. 어떤 시험?',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _Choice(
                    label: '토익',
                    selected: _recommended == 'toeic',
                    onTap: () => _recommend('toeic'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _Choice(
                    label: '토플',
                    selected: _recommended == 'toefl',
                    onTap: () => _recommend('toefl'),
                  ),
                ),
              ],
            ),
          ],
          if (_purpose == 'daily') ...[
            const SizedBox(height: 16),
            Text('2. 현재 수준은?',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _Choice(
                    label: '입문',
                    selected: _recommended == 'beginner',
                    onTap: () => _recommend('beginner'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _Choice(
                    label: '중급',
                    selected: _recommended == 'intermediate',
                    onTap: () => _recommend('intermediate'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _Choice(
                    label: '회화 위주',
                    selected: _recommended == 'conversation',
                    onTap: () => _recommend('conversation'),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 24),
          Text('플랜을 선택하세요',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(
            '추천 배지를 참고하되, 원하는 플랜을 자유롭게 고르세요.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 12),
          ..._tracks.map(
            (t) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _TrackCard(
                track: t,
                isRecommended: _recommended == t.key,
                isCurrent: current == t.key,
                disabled: _saving,
                onTap: () => _choose(t.key),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Choice extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _Choice({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? AppColors.accent : AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.border,
            width: selected ? 1.6 : 1,
          ),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: selected ? AppColors.primaryDark : AppColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
        ),
      ),
    );
  }
}

class _TrackCard extends StatelessWidget {
  final _Track track;
  final bool isRecommended;
  final bool isCurrent;
  final bool disabled;
  final VoidCallback onTap;

  const _TrackCard({
    required this.track,
    required this.isRecommended,
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
            color: isRecommended ? AppColors.primary : AppColors.cardBorder,
            width: isRecommended ? 1.8 : 1,
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
                          Text(track.title,
                              style:
                                  Theme.of(context).textTheme.titleMedium),
                          if (isRecommended) ...[
                            const SizedBox(width: 8),
                            _Badge('추천', AppColors.primary),
                          ],
                          if (isCurrent) ...[
                            const SizedBox(width: 8),
                            _Badge('현재', AppColors.success),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(track.desc,
                          style: Theme.of(context).textTheme.bodyMedium),
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
