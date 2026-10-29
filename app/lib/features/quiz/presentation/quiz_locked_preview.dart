part of 'quiz_screen.dart';

/// Replaces the old single-card paywall. Free users land on the
/// quiz screen and see a top banner pushing them to /subscription,
/// followed by a dimmed preview of the four quiz tabs so they know
/// what they're missing. Tabs are non-functional (server 403s
/// anyway), tapping them just re-fires the upsell.
class _QuizLockedPreview extends ConsumerStatefulWidget {
  final bool iapUnlocked;
  const _QuizLockedPreview({required this.iapUnlocked});

  @override
  ConsumerState<_QuizLockedPreview> createState() => _QuizLockedPreviewState();
}

class _QuizLockedPreviewState extends ConsumerState<_QuizLockedPreview> {
  bool _isRestoring = false;

  Future<void> _restoreSubscription() async {
    setState(() => _isRestoring = true);
    try {
      await _restoreSubscriptionFromStore(ref);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('구독 상태를 확인하고 있어요.')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              friendlyErrorMessage(e, fallback: '구독 상태 확인에 실패했어요.'),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isRestoring = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    void openUpsell(String source) {
      ref.read(analyticsServiceProvider).logSubscriptionUpsellOpened(source);
      context.push('/subscription');
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
      children: [
        // Banner. Tappable only when there's somewhere to send the
        // user — in 1.0.x there's no real /subscription flow yet, so
        // we render the same card as a static notice instead of
        // bouncing them through another "곧 출시" screen.
        CartoonCard(
          color: AppColors.accent,
          padding: EdgeInsets.zero,
          child: InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: widget.iapUnlocked
                ? () => openUpsell('quiz_paywall_banner')
                : null,
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(15),
                    ),
                    child: Icon(
                      widget.iapUnlocked
                          ? Icons.workspace_premium_rounded
                          : Icons.lock_outline_rounded,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.iapUnlocked ? '퀴즈는 프리미엄 전용이에요' : '퀴즈, 곧 만나요',
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: AppColors.primaryDark,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          widget.iapUnlocked
                              ? '구독하시면 4가지 퀴즈 모드를 모두 이용할 수 있어요.'
                              : '다음 업데이트에서 4가지 퀴즈 모드가 열려요.',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: AppColors.primaryDark,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (widget.iapUnlocked) ...[
                    const SizedBox(width: 8),
                    Icon(
                      Icons.chevron_right_rounded,
                      color: AppColors.primaryDark,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 18),
        Text(
          widget.iapUnlocked ? '프리미엄에서 풀 수 있어요' : '다음 업데이트에서 만나요',
          style: theme.textTheme.titleMedium,
        ),
        const SizedBox(height: 10),
        // Dimmed feature preview.
        Opacity(
          opacity: 0.55,
          child: Column(
            children: const [
              _LockedFeatureCard(
                icon: Icons.today_rounded,
                title: '오늘의 퀴즈',
                subtitle: '오늘 학습한 문장을 빈칸/어순/번역/단어 객관식으로 다시 풀어보기',
              ),
              SizedBox(height: 10),
              _LockedFeatureCard(
                icon: Icons.replay_rounded,
                title: '복습 큐 (SRS)',
                subtitle: '최근 30일 안에 틀린 문장을 망각곡선 기반으로 다시 출제',
              ),
              SizedBox(height: 10),
              _LockedFeatureCard(
                icon: Icons.bookmark_rounded,
                title: '단어 퀴즈',
                subtitle: '저장한 단어장 기반 4지선다로 매일 새로운 셋',
              ),
              SizedBox(height: 10),
              _LockedFeatureCard(
                icon: Icons.headphones_rounded,
                title: '리스닝',
                subtitle: '단어 발음을 듣고 의미 맞히기 (TTS 자동 재생)',
              ),
            ],
          ),
        ),
        // The bottom CTA only exists in unlocked builds — in 1.0.x
        // there's nothing to tap through to, so we just leave the
        // preview standing on its own.
        if (widget.iapUnlocked) ...[
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => openUpsell('quiz_paywall_button'),
              icon: const Icon(Icons.workspace_premium_rounded),
              label: const Text('프리미엄 구독하기'),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _isRestoring ? null : _restoreSubscription,
              icon: _isRestoring
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.restore_rounded),
              label: const Text('구독 상태 확인'),
            ),
          ),
        ],
      ],
    );
  }
}

class _LockedFeatureCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  const _LockedFeatureCard({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return CartoonCard(
      padding: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
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
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
            Icon(Icons.lock_outline_rounded, color: AppColors.textHint),
          ],
        ),
      ),
    );
  }
}
