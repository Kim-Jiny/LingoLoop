import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'cute_art.dart';

export 'cute_art.dart' show MascotMood, CuteKind, CuteIcon, FlagBadge, cuteSpan;

/// 카툰풍 공통 카드: 또렷한 윤곽선 + 살짝 어긋난 "스티커" 그림자.
/// 색은 모두 [AppColors]에서 읽어 다크 모드에서도 같이 바뀐다.
class CartoonCard extends StatefulWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final Color? outline;
  final double radius;
  final VoidCallback? onTap;

  const CartoonCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.color,
    this.outline,
    this.radius = 24,
    this.onTap,
  });

  @override
  State<CartoonCard> createState() => _CartoonCardState();
}

class _CartoonCardState extends State<CartoonCard> {
  /// 누르는 동안 카드가 3dp 내려앉고 그림자가 줄어든다 (스티커를 꾹 누르는 느낌).
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final line =
        widget.outline ?? AppColors.textPrimary.withValues(alpha: 0.85);
    final shape = BorderRadius.circular(widget.radius);
    final pressed = _pressed && widget.onTap != null;
    final reduce = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    return AnimatedContainer(
      duration: reduce ? Duration.zero : const Duration(milliseconds: 90),
      curve: Curves.easeOut,
      transform: Matrix4.translationValues(0, pressed ? 3 : 0, 0),
      decoration: BoxDecoration(
        borderRadius: shape,
        boxShadow: [
          BoxShadow(
            color: line,
            offset: Offset(0, pressed ? 1 : 4),
            blurRadius: 0,
          ),
        ],
      ),
      child: Material(
        color: widget.color ?? AppColors.surfaceStrong,
        shape: RoundedRectangleBorder(
          borderRadius: shape,
          side: BorderSide(color: line, width: 2),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: widget.onTap,
          onHighlightChanged: widget.onTap == null
              ? null
              : (v) => setState(() => _pressed = v),
          child: Padding(padding: widget.padding, child: widget.child),
        ),
      ),
    );
  }
}

/// 아래에서 살짝 떠오르며 나타나는 효과. 한 번만 재생. [index]가 클수록
/// 늦게 시작해 목록이 위에서부터 차례로 나타난다(최대 [maxDelay]).
class FadeSlideIn extends StatefulWidget {
  final Widget child;
  final int index;
  final Duration step;
  final Duration maxDelay;

  const FadeSlideIn({
    super.key,
    required this.child,
    this.index = 0,
    this.step = const Duration(milliseconds: 55),
    this.maxDelay = const Duration(milliseconds: 330),
  });

  @override
  State<FadeSlideIn> createState() => _FadeSlideInState();
}

class _FadeSlideInState extends State<FadeSlideIn>
    with SingleTickerProviderStateMixin {
  static const _anim = Duration(milliseconds: 360);

  late final Duration _delay = Duration(
    milliseconds: (widget.step.inMilliseconds * widget.index).clamp(
      0,
      widget.maxDelay.inMilliseconds,
    ),
  );
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: _delay + _anim,
  );
  late final Animation<double> _t = CurvedAnimation(
    parent: _c,
    curve: Interval(
      _delay.inMilliseconds / (_delay + _anim).inMilliseconds,
      1,
      curve: Curves.easeOutCubic,
    ),
  );

  @override
  void initState() {
    super.initState();
    _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
      return widget.child;
    }
    return AnimatedBuilder(
      animation: _t,
      child: widget.child,
      builder: (context, child) => Opacity(
        opacity: _t.value,
        child: Transform.translate(
          offset: Offset(0, 14 * (1 - _t.value)),
          child: child,
        ),
      ),
    );
  }
}

/// 목록 children을 위에서부터 차례로 떠오르게 감싼다. 간격용 SizedBox는
/// 그대로 둔다.
List<Widget> staggerIn(List<Widget> children) {
  var i = 0;
  return [
    for (final w in children)
      if (w is SizedBox) w else FadeSlideIn(index: i++, child: w),
  ];
}

/// 값이 바뀔 때(처음 포함) 0 → 값으로 차오르는 진행 막대.
class AnimatedProgressBar extends StatelessWidget {
  final double value;
  final double minHeight;
  final Color? color;
  final Color? background;
  final BorderRadius? borderRadius;

  const AnimatedProgressBar({
    super.key,
    required this.value,
    this.minHeight = 10,
    this.color,
    this.background,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    return ClipRRect(
      borderRadius: borderRadius ?? BorderRadius.circular(999),
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: value.clamp(0.0, 1.0)),
        duration: reduce ? Duration.zero : const Duration(milliseconds: 700),
        curve: Curves.easeOutCubic,
        builder: (context, v, _) => LinearProgressIndicator(
          value: v,
          minHeight: minHeight,
          backgroundColor: background ?? AppColors.accent,
          valueColor: AlwaysStoppedAnimation(color ?? AppColors.primary),
        ),
      ),
    );
  }
}

/// 한 번 좌우로 흔들리는 효과 (오답 등).
class ShakeOnce extends StatefulWidget {
  final Widget child;
  const ShakeOnce({super.key, required this.child});

  @override
  State<ShakeOnce> createState() => _ShakeOnceState();
}

class _ShakeOnceState extends State<ShakeOnce>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
  )..forward();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
      return widget.child;
    }
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        // 감쇠하는 사인파: 8dp에서 시작해 0으로.
        final t = _c.value;
        final dx = 8 * (1 - t) * math.sin(t * math.pi * 6);
        return Transform.translate(offset: Offset(dx, 0), child: child);
      },
    );
  }
}

/// 처음 나타날 때 통통 튀며 커지는 효과. 한 번만 재생.
class BounceIn extends StatefulWidget {
  final Widget child;
  final Duration delay;

  const BounceIn({super.key, required this.child, this.delay = Duration.zero});

  @override
  State<BounceIn> createState() => _BounceInState();
}

class _BounceInState extends State<BounceIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 520),
  );

  @override
  void initState() {
    super.initState();
    if (widget.delay == Duration.zero) {
      _c.forward();
    } else {
      _timer = Timer(widget.delay, () {
        if (mounted) _c.forward();
      });
    }
  }

  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // 접근성: 시스템에서 애니메이션을 끈 경우 바로 표시.
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
      return widget.child;
    }
    return ScaleTransition(
      scale: CurvedAnimation(parent: _c, curve: Curves.elasticOut),
      child: FadeTransition(opacity: _c, child: widget.child),
    );
  }
}

/// 코드로 직접 그린 마스코트. 감정(mood)만 받으므로 나중에 일러스트로 교체해도
/// 호출부는 그대로 둔다.
class Mascot extends StatelessWidget {
  final MascotMood mood;
  final double size;

  const Mascot({super.key, this.mood = MascotMood.happy, this.size = 56});

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: MascotFace(mood: mood, size: size),
    );
  }
}

/// 화면 전체 안내(오류·빈 상태)용: 마스코트가 말해 주는 한 덩어리.
class MascotMessage extends StatelessWidget {
  final String message;
  final MascotMood mood;
  final double mascotSize;

  const MascotMessage({
    super.key,
    required this.message,
    this.mood = MascotMood.think,
    this.mascotSize = 72,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Mascot(mood: mood, size: mascotSize),
        const SizedBox(height: 14),
        Text(
          message,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    );
  }
}

/// 섹션 제목: 주황 막대 + 제목(+ 오른쪽 보조 문구). 모든 탭에서 같은 모양을 쓴다.
class SectionHeader extends StatelessWidget {
  final String title;
  final String? trailing;

  const SectionHeader(this.title, {super.key, this.trailing});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 6,
          height: 20,
          decoration: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(child: Text(title, style: theme.textTheme.titleLarge)),
        if (trailing != null) Text(trailing!, style: theme.textTheme.bodySmall),
      ],
    );
  }
}
