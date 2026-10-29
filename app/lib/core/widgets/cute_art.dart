import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// 이모지 대신 코드로 직접 그린 귀여운 그림들. 에셋/패키지 없이 CustomPainter만
/// 쓰고, 색은 [AppColors]에서 읽어 다크 모드에서도 같이 바뀐다.

enum MascotMood { happy, cheer, think, sleepy }

enum CuteKind { party, lock, bookmark, speaker }

Color get _ink => AppColors.textPrimary.withValues(alpha: 0.85);

Paint _stroke(double w) => Paint()
  ..style = PaintingStyle.stroke
  ..strokeWidth = w
  ..color = _ink
  ..strokeCap = StrokeCap.round
  ..strokeJoin = StrokeJoin.round;

Paint _fill(Color c) => Paint()
  ..style = PaintingStyle.fill
  ..color = c;

/// 네 갈래 반짝이.
Path _sparkle(Offset c, double r) {
  final p = Path();
  for (var i = 0; i < 8; i++) {
    final rad = i.isEven ? r : r * 0.34;
    final a = -math.pi / 2 + i * math.pi / 4;
    final pt = Offset(c.dx + rad * math.cos(a), c.dy + rad * math.sin(a));
    i == 0 ? p.moveTo(pt.dx, pt.dy) : p.lineTo(pt.dx, pt.dy);
  }
  return p..close();
}

// ───────────────────────────── 마스코트 ─────────────────────────────

class MascotFace extends StatelessWidget {
  final MascotMood mood;
  final double size;

  const MascotFace({super.key, required this.mood, required this.size});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _MascotPainter(mood)),
    );
  }
}

class _MascotPainter extends CustomPainter {
  final MascotMood mood;
  _MascotPainter(this.mood);

  @override
  void paint(Canvas c, Size size) {
    final s = size.width;
    final sw = math.max(1.6, s * 0.04);
    final line = _stroke(sw);
    final skin = Color.lerp(AppColors.accent, AppColors.primary, 0.45)!;
    final blush = const Color(0xFFFF8FAB).withValues(alpha: 0.55);

    // 귀
    for (final dx in [0.27, 0.73]) {
      final ear = Offset(s * dx, s * 0.21);
      c.drawCircle(ear, s * 0.13, _fill(skin));
      c.drawCircle(ear, s * 0.13, line);
      c.drawCircle(ear, s * 0.06, _fill(blush));
    }
    // 얼굴
    final face = Offset(s * 0.5, s * 0.56);
    c.drawCircle(face, s * 0.39, _fill(skin));
    c.drawCircle(face, s * 0.39, line);
    // 볼터치
    for (final dx in [0.25, 0.75]) {
      c.drawOval(
        Rect.fromCenter(
          center: Offset(s * dx, s * 0.66),
          width: s * 0.13,
          height: s * 0.075,
        ),
        _fill(blush),
      );
    }

    final eyeL = Offset(s * 0.37, s * 0.54);
    final eyeR = Offset(s * 0.63, s * 0.54);

    void dotEye(Offset o) {
      c.drawOval(
        Rect.fromCenter(center: o, width: s * 0.09, height: s * 0.12),
        _fill(_ink),
      );
      c.drawCircle(
        o.translate(-s * 0.014, -s * 0.02),
        s * 0.017,
        _fill(Colors.white),
      );
    }

    void arcEye(Offset o, {required bool up}) {
      final p = Path()
        ..moveTo(o.dx - s * 0.06, o.dy + (up ? s * 0.02 : -s * 0.01))
        ..quadraticBezierTo(
          o.dx,
          o.dy + (up ? -s * 0.08 : s * 0.07),
          o.dx + s * 0.06,
          o.dy + (up ? s * 0.02 : -s * 0.01),
        );
      c.drawPath(p, line);
    }

    switch (mood) {
      case MascotMood.happy:
        dotEye(eyeL);
        dotEye(eyeR);
        c.drawPath(
          Path()
            ..moveTo(s * 0.43, s * 0.65)
            ..quadraticBezierTo(s * 0.5, s * 0.73, s * 0.57, s * 0.65),
          line,
        );
      case MascotMood.cheer:
        arcEye(eyeL, up: true);
        arcEye(eyeR, up: true);
        final mouth = Path()
          ..moveTo(s * 0.41, s * 0.62)
          ..lineTo(s * 0.59, s * 0.62)
          ..quadraticBezierTo(s * 0.5, s * 0.84, s * 0.41, s * 0.62)
          ..close();
        c.drawPath(mouth, _fill(const Color(0xFFB83A4B)));
        c.drawPath(mouth, line);
        c.drawCircle(
          Offset(s * 0.5, s * 0.715),
          s * 0.035,
          _fill(const Color(0xFFFF8FAB)),
        );
        c.drawPath(
          _sparkle(Offset(s * 0.9, s * 0.3), s * 0.09),
          _fill(AppColors.warning),
        );
        c.drawPath(
          _sparkle(Offset(s * 0.1, s * 0.38), s * 0.06),
          _fill(AppColors.warning),
        );
      case MascotMood.think:
        // 눈은 위쪽(생각하는 방향)을 보고, 한쪽 눈썹만 둥글게 올려 갸웃한 인상.
        // (눈썹을 안쪽으로 기울이면 화난 얼굴이 되므로 쓰지 않는다.)
        dotEye(eyeL.translate(s * 0.01, -s * 0.015));
        dotEye(eyeR.translate(s * 0.01, -s * 0.015));
        c.drawPath(
          Path()
            ..moveTo(s * 0.55, s * 0.4)
            ..quadraticBezierTo(s * 0.63, s * 0.32, s * 0.71, s * 0.4),
          line,
        );
        // 살짝 올라간 작은 미소.
        c.drawPath(
          Path()
            ..moveTo(s * 0.45, s * 0.67)
            ..quadraticBezierTo(s * 0.52, s * 0.71, s * 0.58, s * 0.65),
          line,
        );
        // 생각 방울
        c.drawCircle(
          Offset(s * 0.86, s * 0.24),
          s * 0.025,
          _fill(Colors.white),
        );
        c.drawCircle(Offset(s * 0.86, s * 0.24), s * 0.025, _stroke(sw * 0.6));
        c.drawCircle(Offset(s * 0.92, s * 0.1), s * 0.045, _fill(Colors.white));
        c.drawCircle(Offset(s * 0.92, s * 0.1), s * 0.045, _stroke(sw * 0.6));
      case MascotMood.sleepy:
        arcEye(eyeL, up: false);
        arcEye(eyeR, up: false);
        c.drawOval(
          Rect.fromCenter(
            center: Offset(s * 0.5, s * 0.68),
            width: s * 0.06,
            height: s * 0.07,
          ),
          _fill(_ink.withValues(alpha: 0.25)),
        );
        c.drawOval(
          Rect.fromCenter(
            center: Offset(s * 0.5, s * 0.68),
            width: s * 0.06,
            height: s * 0.07,
          ),
          _stroke(sw * 0.8),
        );
        // zZ
        void z(Offset o, double w) {
          c.drawPath(
            Path()
              ..moveTo(o.dx, o.dy)
              ..lineTo(o.dx + w, o.dy)
              ..lineTo(o.dx, o.dy + w)
              ..lineTo(o.dx + w, o.dy + w),
            _stroke(sw * 0.7),
          );
        }
        z(Offset(s * 0.8, s * 0.2), s * 0.09);
        z(Offset(s * 0.9, s * 0.08), s * 0.06);
    }
  }

  @override
  bool shouldRepaint(_MascotPainter old) => old.mood != mood;
}

// ───────────────────────────── 작은 아이콘 ─────────────────────────────

/// 인라인 텍스트 뒤에 붙이는 용도: `Text.rich(TextSpan(children: [..., cuteSpan(CuteKind.party)]))`.
InlineSpan cuteSpan(CuteKind kind, {double size = 18}) => WidgetSpan(
  alignment: PlaceholderAlignment.middle,
  child: Padding(
    padding: const EdgeInsets.only(left: 2),
    child: CuteIcon(kind, size: size),
  ),
);

class CuteIcon extends StatelessWidget {
  final CuteKind kind;
  final double size;

  const CuteIcon(this.kind, {super.key, this.size = 20});

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: SizedBox(
        width: size,
        height: size,
        child: CustomPaint(painter: _CutePainter(kind)),
      ),
    );
  }
}

class _CutePainter extends CustomPainter {
  final CuteKind kind;
  _CutePainter(this.kind);

  @override
  void paint(Canvas c, Size size) {
    final s = size.width;
    final line = _stroke(math.max(1.2, s * 0.07));
    Offset o(double x, double y) => Offset(s * x, s * y);

    switch (kind) {
      case CuteKind.party:
        final cone = Path()
          ..moveTo(s * 0.1, s * 0.92)
          ..lineTo(s * 0.36, s * 0.36)
          ..quadraticBezierTo(s * 0.56, s * 0.42, s * 0.64, s * 0.66)
          ..close();
        c.drawPath(cone, _fill(AppColors.warning));
        // 줄무늬
        for (final t in [0.4, 0.7]) {
          final a = Offset.lerp(o(0.1, 0.92), o(0.36, 0.36), t)!;
          final b = Offset.lerp(o(0.1, 0.92), o(0.64, 0.66), t)!;
          c.drawLine(
            a,
            b,
            _stroke(math.max(1, s * 0.05))..color = _ink.withValues(alpha: 0.5),
          );
        }
        c.drawPath(cone, line);
        // 색종이
        c.drawCircle(o(0.74, 0.2), s * 0.065, _fill(const Color(0xFFFF7A9C)));
        c.drawCircle(o(0.9, 0.44), s * 0.05, _fill(AppColors.info));
        c.drawCircle(o(0.5, 0.12), s * 0.05, _fill(AppColors.success));
        c.drawLine(
          o(0.66, 0.36),
          o(0.78, 0.3),
          _stroke(math.max(1.2, s * 0.06))..color = const Color(0xFFFF7A9C),
        );
      case CuteKind.lock:
        final shackle = Path()
          ..moveTo(s * 0.32, s * 0.48)
          ..lineTo(s * 0.32, s * 0.34)
          ..arcTo(
            Rect.fromLTRB(s * 0.32, s * 0.12, s * 0.68, s * 0.56),
            math.pi,
            math.pi,
            false,
          )
          ..lineTo(s * 0.68, s * 0.48);
        c.drawPath(shackle, _stroke(math.max(1.6, s * 0.1)));
        final body = RRect.fromRectAndRadius(
          Rect.fromLTRB(s * 0.18, s * 0.46, s * 0.82, s * 0.92),
          Radius.circular(s * 0.14),
        );
        c.drawRRect(body, _fill(AppColors.warning));
        c.drawRRect(body, line);
        c.drawCircle(o(0.5, 0.64), s * 0.07, _fill(_ink));
        c.drawRect(
          Rect.fromLTRB(s * 0.47, s * 0.64, s * 0.53, s * 0.78),
          _fill(_ink),
        );
      case CuteKind.bookmark:
        final p = Path()
          ..moveTo(s * 0.26, s * 0.1)
          ..lineTo(s * 0.74, s * 0.1)
          ..lineTo(s * 0.74, s * 0.9)
          ..lineTo(s * 0.5, s * 0.68)
          ..lineTo(s * 0.26, s * 0.9)
          ..close();
        c.drawPath(p, _fill(AppColors.primary));
        c.drawPath(p, line);
        c.drawCircle(
          o(0.42, 0.28),
          s * 0.06,
          _fill(Colors.white.withValues(alpha: 0.85)),
        );
      case CuteKind.speaker:
        final p = Path()
          ..moveTo(s * 0.1, s * 0.4)
          ..lineTo(s * 0.26, s * 0.4)
          ..lineTo(s * 0.48, s * 0.2)
          ..lineTo(s * 0.48, s * 0.8)
          ..lineTo(s * 0.26, s * 0.6)
          ..lineTo(s * 0.1, s * 0.6)
          ..close();
        c.drawPath(p, _fill(AppColors.info));
        c.drawPath(p, line);
        for (final r in [0.2, 0.34]) {
          c.drawArc(
            Rect.fromCircle(center: o(0.5, 0.5), radius: s * r),
            -0.75,
            1.5,
            false,
            line,
          );
        }
    }
  }

  @override
  bool shouldRepaint(_CutePainter old) => old.kind != kind;
}

// ───────────────────────────── 국기 배지 ─────────────────────────────

/// 국기 이모지 대신 쓰는 동그란 국기 배지. 지원하지 않는 언어 코드는 지구본.
class FlagBadge extends StatelessWidget {
  final String code;
  final double size;

  const FlagBadge({super.key, required this.code, this.size = 40});

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: SizedBox(
        width: size,
        height: size,
        child: CustomPaint(painter: _FlagPainter(code)),
      ),
    );
  }
}

class _FlagPainter extends CustomPainter {
  final String code;
  _FlagPainter(this.code);

  @override
  void paint(Canvas c, Size size) {
    final s = size.width;
    final circle = Rect.fromLTWH(0, 0, s, s);
    final clip = Path()..addOval(circle.deflate(s * 0.03));
    c.save();
    c.clipPath(clip);
    switch (code) {
      case 'ja':
        c.drawRect(circle, _fill(Colors.white));
        c.drawCircle(
          Offset(s / 2, s / 2),
          s * 0.22,
          _fill(const Color(0xFFE53950)),
        );
      case 'en':
        const red = Color(0xFFE5484D);
        final h = s / 7;
        c.drawRect(circle, _fill(Colors.white));
        for (var i = 0; i < 7; i += 2) {
          c.drawRect(Rect.fromLTWH(0, i * h, s, h), _fill(red));
        }
        c.drawRect(
          Rect.fromLTWH(0, 0, s * 0.52, h * 4),
          _fill(const Color(0xFF3B5BA9)),
        );
        for (var r = 0; r < 2; r++) {
          for (var k = 0; k < 3; k++) {
            c.drawCircle(
              Offset(
                s * (0.12 + k * 0.14 + (r.isOdd ? 0.07 : 0)),
                s * (0.12 + r * 0.17),
              ),
              s * 0.03,
              _fill(Colors.white),
            );
          }
        }
      default:
        c.drawRect(circle, _fill(AppColors.info.withValues(alpha: 0.35)));
        final g = _stroke(math.max(1.2, s * 0.04));
        c.drawOval(
          Rect.fromCenter(
            center: Offset(s / 2, s / 2),
            width: s * 0.42,
            height: s * 0.86,
          ),
          g,
        );
        c.drawLine(Offset(s * 0.07, s / 2), Offset(s * 0.93, s / 2), g);
    }
    c.restore();
    c.drawOval(circle.deflate(s * 0.03), _stroke(math.max(1.6, s * 0.055)));
  }

  @override
  bool shouldRepaint(_FlagPainter old) => old.code != code;
}
