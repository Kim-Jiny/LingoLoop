import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
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
    '매일 딱 한 문장. 외우려 애쓰지 않아도\n생활 속에서 자연스럽게 익숙해져요.',
  ),
  _Slide(
    Icons.notifications_active_rounded,
    '앱을 안 열어도\n알림이 다시 떠올려줘요',
    '설정한 주기로 오늘의 문장이 다시 도착해요.\n잊을 만하면 살짝, 반복이 핵심이에요.',
  ),
  _Slide(
    Icons.replay_rounded,
    '복습과 단어장으로\n기억을 굳혀요',
    '망각곡선에 맞춰 다시 꺼내보고,\n단어장에 모아 두며 오래 기억해요.',
  ),
  _Slide(
    Icons.widgets_rounded,
    '홈 화면에 오늘 문장을\n띄워두세요',
    '홈 화면 위젯으로 오늘 문장과 단어장이\n늘 보여요. 무심코 한 번 더 마주쳐요.',
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

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _finish({required bool enablePush}) async {
    if (_busy) return;
    setState(() => _busy = true);
    if (enablePush) {
      await ref.read(pushServiceProvider).initialize();
    }
    await completeOnboarding(ref);
    // Router redirect (watching onboardingSeenProvider) takes over from here.
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _page == _slides.length - 1;

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
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: _busy ? null : () => _finish(enablePush: false),
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
                              style: Theme.of(
                                context,
                              ).textTheme.headlineMedium?.copyWith(height: 1.3),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              s.body,
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.bodyLarge
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
                        children: [
                          ElevatedButton.icon(
                            onPressed: _busy
                                ? null
                                : () => _finish(enablePush: true),
                            icon: const Icon(
                              Icons.notifications_active_rounded,
                            ),
                            label: const Text('알림 켜고 시작하기'),
                          ),
                          TextButton(
                            onPressed: _busy
                                ? null
                                : () => _finish(enablePush: false),
                            child: const Text('알림 없이 시작'),
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
          ),
        ),
      ),
    );
  }
}
