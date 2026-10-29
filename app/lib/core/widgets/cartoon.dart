import 'dart:async';

import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// 카툰풍 공통 카드: 또렷한 윤곽선 + 살짝 어긋난 "스티커" 그림자.
/// 색은 모두 [AppColors]에서 읽어 다크 모드에서도 같이 바뀐다.
class CartoonCard extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final line = outline ?? AppColors.textPrimary.withValues(alpha: 0.85);
    final shape = BorderRadius.circular(radius);
    return Container(
      decoration: BoxDecoration(
        borderRadius: shape,
        boxShadow: [
          BoxShadow(color: line, offset: const Offset(0, 4), blurRadius: 0),
        ],
      ),
      child: Material(
        color: color ?? AppColors.surfaceStrong,
        shape: RoundedRectangleBorder(
          borderRadius: shape,
          side: BorderSide(color: line, width: 2),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(padding: padding, child: child),
        ),
      ),
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

enum MascotMood { happy, cheer, think, sleepy }

/// 이모지로 그린 임시 마스코트. 나중에 일러스트로 교체해도 호출부는
/// 그대로 두도록 감정(mood)만 받는다.
class Mascot extends StatelessWidget {
  final MascotMood mood;
  final double size;

  const Mascot({super.key, this.mood = MascotMood.happy, this.size = 56});

  @override
  Widget build(BuildContext context) {
    final face = switch (mood) {
      MascotMood.happy => '😊',
      MascotMood.cheer => '🥳',
      MascotMood.think => '🤔',
      MascotMood.sleepy => '😴',
    };
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.accent,
        shape: BoxShape.circle,
        border: Border.all(
          color: AppColors.textPrimary.withValues(alpha: 0.85),
          width: 2,
        ),
      ),
      child: ExcludeSemantics(
        child: Text(face, style: TextStyle(fontSize: size * 0.55)),
      ),
    );
  }
}
