import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import '../../../core/theme/app_colors.dart';
import '../../notification/data/notification_repository.dart';
import '../../notification/data/push_service.dart';
import '../domain/onboarding_provider.dart';

class _Slide {
  final IconData icon;
  final String title;
  final String body;
  const _Slide(this.icon, this.title, this.body);
}

const _slides = [
  _Slide(
    Icons.wb_sunny_rounded,
    '하루 한 문장,\n부담 없이 시작해요',
    '매일 딱 한 문장이면 1년에 약 350문장,\n핵심 단어까지 1,000개 이상을 익혀요.\n외우려 애쓰지 않아도 자연스럽게 쌓여요.',
  ),
  _Slide(
    Icons.replay_rounded,
    '복습과 단어장으로\n기억을 굳혀요',
    '망각곡선에 맞춰 다시 꺼내보고,\n오늘 문장의 단어 옆 책갈피(🔖)를 누르면\n단어장에 모여서 나중에 다시 볼 수 있어요.',
  ),
  _Slide(
    Icons.widgets_rounded,
    '홈 화면에 오늘 문장을\n띄워두세요',
    '홈 화면 위젯으로 오늘 문장과 단어장이\n늘 보여요. 무심코 한 번 더 마주쳐요.',
  ),
  _Slide(
    Icons.notifications_active_rounded,
    '알림이 곧 학습이에요\n링고루프의 핵심 기능',
    '앱을 안 열어도 설정한 주기에 오늘 문장이\n잠금화면에 떠올라요. 짧게라도 매일 마주치는\n그 순간이 1년 뒤 실력 차이를 만들어요.\n\n알림이 꺼져 있으면 학습 루프 자체가 멈춰요.\n주기·시간대는 설정에서 언제든 바꿀 수 있어요.',
  ),
];

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _controller = PageController();
  int _page = 0;
  bool _busy = false;

  /// `null` = 슬라이드 단계, non-null = inline 알림 설정 단계 진입.
  /// "알림 켜고 시작하기"를 누르고 OS 권한을 받아낸 뒤 표시되는
  /// 미니 설정 패널 (반복주기 + 활성시간 + 루프 토글) 상태.
  _PushSetupState? _setup;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _finishWithoutPush() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await completeOnboarding(ref);
      // Router redirect (watching onboardingSeenProvider) takes over.
    } finally {
      // Router가 즉시 redirect 못 하는 케이스(예: languageTracksProvider
      // 가 loading 중)에 버튼이 영구 stuck되지 않게 복원.
      if (mounted) setState(() => _busy = false);
    }
  }

  /// "알림 켜고 시작하기" — OS 권한 → 받았으면 inline 설정으로 전환,
  /// 거부되면 그냥 온보딩 완료 (사용자가 나중에 설정에서 켤 수 있음).
  Future<void> _enablePushAndConfigure() async {
    if (_busy) return;
    setState(() => _busy = true);
    final outcome =
        await ref.read(pushServiceProvider).requestPermissionAndInit();
    if (!mounted) return;
    if (outcome == PushPermissionOutcome.granted) {
      setState(() {
        _busy = false;
        _setup = _PushSetupState();
      });
    } else {
      // 권한 거부 / OS 미지원 — 안내 후 온보딩만 완료. 알림은 설정에서
      // 다시 켤 수 있음. (denied면 OS가 다이얼로그를 안 띄움 → 설정 이동
      // 안내가 더 정확하지만, 온보딩 흐름 단순화를 위해 일단 다음 단계.)
      try {
        await completeOnboarding(ref);
      } finally {
        if (mounted) setState(() => _busy = false);
      }
    }
  }

  /// inline 설정 저장 → onboarding 완료. Router가 /track으로 보냄.
  Future<void> _saveSetupAndContinue() async {
    if (_busy || _setup == null) return;
    final s = _setup!;
    final startMin = s.start.hour * 60 + s.start.minute;
    final endMin = s.end.hour * 60 + s.end.minute;
    if (s.enabled && startMin >= endMin) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('활성 종료 시각은 시작 시각보다 늦어야 해요.'),
        ),
      );
      return;
    }
    setState(() => _busy = true);
    bool saveFailed = false;
    try {
      String? tz;
      try {
        tz = await FlutterTimezone.getLocalTimezone();
      } catch (_) {}
      try {
        await ref.read(notificationRepositoryProvider).updateSettings(
              isEnabled: s.enabled,
              frequencyMinutes: s.frequency,
              timezone: tz,
              activeStartTime: _hhmm(s.start),
              activeEndTime: _hhmm(s.end),
            );
      } catch (_) {
        // 저장 실패해도 온보딩은 계속 — 사용자가 설정에서 다시 시도 가능.
        // 단, 사용자에게 인지시키기 위해 SnackBar 노출.
        saveFailed = true;
      }
      await completeOnboarding(ref);
    } finally {
      // _busy 복원 — completeOnboarding 후 router가 즉시 redirect 못 하는
      // 케이스(예: languageTracksProvider가 아직 loading 중)에선 사용자가
      // 버튼이 "저장 중..."에 영구 stuck돼 다음 단계로 못 넘어가던 버그.
      if (mounted) setState(() => _busy = false);
    }
    if (saveFailed && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('알림 설정 저장에 실패했어요. 설정 화면에서 다시 시도해 주세요.'),
        ),
      );
    }
  }

  String _hhmm(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppColors.gradientStart,
              AppColors.background,
              AppColors.gradientEnd,
            ],
          ),
        ),
        child: SafeArea(
          child: _setup != null
              ? _buildSetupPanel(context)
              : _buildSlides(context),
        ),
      ),
    );
  }

  // ──────────────────────────── 슬라이드 단계 ────────────────────────────

  Widget _buildSlides(BuildContext context) {
    final isLast = _page == _slides.length - 1;
    return Column(
      children: [
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            // 건너뛰기는 알림 권한 묻지 않음 — 명시적 'skip' 의도.
            // 사용자는 추후 설정에서 알림을 켤 수 있음.
            onPressed: _busy ? null : _finishWithoutPush,
            child: const Text('건너뛰기'),
          ),
        ),
        Expanded(
          child: PageView.builder(
            controller: _controller,
            itemCount: _slides.length,
            onPageChanged: (i) => setState(() => _page = i),
            itemBuilder: (context, i) {
              final s = _slides[i];
              return Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 32,
                    vertical: 24,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 104,
                        height: 104,
                        decoration: BoxDecoration(
                          color: AppColors.accent,
                          borderRadius: BorderRadius.circular(32),
                        ),
                        child: Icon(
                          s.icon,
                          size: 50,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(height: 32),
                      Text(
                        s.title,
                        textAlign: TextAlign.center,
                        style: Theme.of(context)
                            .textTheme
                            .headlineMedium
                            ?.copyWith(height: 1.3),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        s.body,
                        textAlign: TextAlign.center,
                        style: Theme.of(context)
                            .textTheme
                            .bodyLarge
                            ?.copyWith(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(_slides.length, (i) {
            final active = i == _page;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 4),
              width: active ? 22 : 8,
              height: 8,
              decoration: BoxDecoration(
                color: active ? AppColors.primary : AppColors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            );
          }),
        ),
        const SizedBox(height: 28),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
          child: isLast
              ? Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // 보조 CTA를 작게 위에 — 1차 액션(알림 켜고 시작하기)
                    // 위치를 다른 슬라이드의 '다음' 버튼과 동일하게 맞추기
                    // 위해 보조를 작게 얹는 방식.
                    TextButton(
                      onPressed: _busy ? null : _finishWithoutPush,
                      style: TextButton.styleFrom(
                        minimumSize: const Size(0, 32),
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        textStyle: const TextStyle(fontSize: 13),
                      ),
                      child: const Text('알림 없이 시작'),
                    ),
                    const SizedBox(height: 4),
                    ElevatedButton.icon(
                      onPressed: _busy ? null : _enablePushAndConfigure,
                      icon: const Icon(Icons.notifications_active_rounded),
                      label: const Text('알림 켜고 시작하기'),
                    ),
                  ],
                )
              : ElevatedButton(
                  onPressed: _busy
                      ? null
                      : () => _controller.nextPage(
                            duration: const Duration(milliseconds: 280),
                            curve: Curves.easeOut,
                          ),
                  child: const Text('다음'),
                ),
        ),
      ],
    );
  }

  // ───────────────────────── inline 알림 설정 ─────────────────────────

  Widget _buildSetupPanel(BuildContext context) {
    final s = _setup!;
    return Column(
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: _busy ? null : () => setState(() => _setup = null),
            icon: const Icon(Icons.arrow_back_rounded, size: 18),
            label: const Text('돌아가기'),
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
            children: [
              Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(26),
                ),
                child: Icon(
                  Icons.notifications_active_rounded,
                  size: 40,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                '알림 루프 설정',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              Text(
                '나에게 맞는 주기와 시간대를 골라주세요.\n언제든 설정에서 다시 바꿀 수 있어요.',
                textAlign: TextAlign.center,
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 24),
              _Section(
                title: '푸시 루프 사용',
                child: SwitchListTile.adaptive(
                  contentPadding: EdgeInsets.zero,
                  title: Text(s.enabled ? '루프 활성화' : '루프 일시정지'),
                  subtitle: Text(
                    s.enabled
                        ? '정해둔 간격마다 오늘 문장을 다시 노출해요.'
                        : '지금은 어떤 문장도 푸시되지 않아요.',
                    style: const TextStyle(fontSize: 12),
                  ),
                  value: s.enabled,
                  onChanged: (v) => setState(() => s.enabled = v),
                ),
              ),
              const SizedBox(height: 16),
              _Section(
                title: '반복 주기',
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _freeFrequencies
                      .map((m) => ChoiceChip(
                            label: Text(_minLabel(m)),
                            selected: s.frequency == m,
                            onSelected: s.enabled
                                ? (_) => setState(() => s.frequency = m)
                                : null,
                          ))
                      .toList(),
                ),
              ),
              const SizedBox(height: 16),
              _Section(
                title: '활성 시간대',
                child: Row(
                  children: [
                    Expanded(
                      child: _TimePill(
                        label: '시작',
                        time: s.start,
                        enabled: s.enabled,
                        onTap: () async {
                          final t = await showTimePicker(
                            context: context,
                            initialTime: s.start,
                          );
                          if (t != null) setState(() => s.start = t);
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _TimePill(
                        label: '종료',
                        time: s.end,
                        enabled: s.enabled,
                        onTap: () async {
                          final t = await showTimePicker(
                            context: context,
                            initialTime: s.end,
                          );
                          if (t != null) setState(() => s.end = t);
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
          child: ElevatedButton(
            onPressed: _busy ? null : _saveSetupAndContinue,
            child: Text(_busy ? '저장 중...' : '저장하고 계속'),
          ),
        ),
      ],
    );
  }
}

/// inline 설정 패널의 mutable 상태. 무료 사용자 기본값 — 4시간 / 9시~22시 / on.
class _PushSetupState {
  bool enabled = true;
  int frequency = 240;
  TimeOfDay start = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay end = const TimeOfDay(hour: 22, minute: 0);
}

const _freeFrequencies = [180, 240, 360];

String _minLabel(int m) {
  if (m < 60) return '$m분';
  final h = m ~/ 60;
  final r = m % 60;
  return r == 0 ? '$h시간' : '$h시간 $r분';
}

class _Section extends StatelessWidget {
  final String title;
  final Widget child;

  const _Section({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _TimePill extends StatelessWidget {
  final String label;
  final TimeOfDay time;
  final bool enabled;
  final VoidCallback onTap;

  const _TimePill({
    required this.label,
    required this.time,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final h = time.hour.toString().padLeft(2, '0');
    final m = time.minute.toString().padLeft(2, '0');
    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.cardBorder),
        ),
        child: Row(
          children: [
            Text(
              '$label  ',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: AppColors.textSecondary),
            ),
            Expanded(
              child: Text(
                '$h:$m',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            Icon(
              Icons.access_time_rounded,
              size: 18,
              color: AppColors.textSecondary,
            ),
          ],
        ),
      ),
    );
  }
}
