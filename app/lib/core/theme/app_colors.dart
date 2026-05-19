import 'package:flutter/material.dart';

/// Color palette for one brightness. Widgets read colors via [AppColors],
/// which delegates to the active palette. The active palette is swapped in
/// `MaterialApp.builder` from the resolved theme brightness, so the existing
/// `AppColors.xxx` call sites keep working without a per-widget refactor.
class AppPalette {
  final Color primary;
  final Color primaryLight;
  final Color primaryDark;
  final Color accent;
  final Color background;
  final Color backgroundMuted;
  final Color surface;
  final Color surfaceStrong;
  final Color surfaceLight;
  final Color border;
  final Color cardBorder;
  final Color textPrimary;
  final Color textSecondary;
  final Color textHint;
  final Color softShadow;
  final Color success;
  final Color warning;
  final Color error;
  final Color info;
  final Color beginner;
  final Color intermediate;
  final Color advanced;
  final Color gradientStart;
  final Color gradientEnd;

  const AppPalette({
    required this.primary,
    required this.primaryLight,
    required this.primaryDark,
    required this.accent,
    required this.background,
    required this.backgroundMuted,
    required this.surface,
    required this.surfaceStrong,
    required this.surfaceLight,
    required this.border,
    required this.cardBorder,
    required this.textPrimary,
    required this.textSecondary,
    required this.textHint,
    required this.softShadow,
    required this.success,
    required this.warning,
    required this.error,
    required this.info,
    required this.beginner,
    required this.intermediate,
    required this.advanced,
    required this.gradientStart,
    required this.gradientEnd,
  });
}

const lightPalette = AppPalette(
  primary: Color(0xFFF26B3A),
  primaryLight: Color(0xFFFFC29F),
  primaryDark: Color(0xFFB84A22),
  accent: Color(0xFFFFE7D6),
  background: Color(0xFFFBF5EC),
  backgroundMuted: Color(0xFFF4EADC),
  surface: Color(0xFFFFFDF9),
  surfaceStrong: Color(0xFFFFFCF6),
  surfaceLight: Color(0xFFF6EEE2),
  border: Color(0xFFEEDFCC),
  cardBorder: Color(0xFFF0E4D4),
  textPrimary: Color(0xFF33261B),
  textSecondary: Color(0xFF6E5C49),
  textHint: Color(0xFFA8957F),
  softShadow: Color(0x14C9874A),
  success: Color(0xFF2F8F5B),
  warning: Color(0xFFD38A18),
  error: Color(0xFFCF4C3C),
  info: Color(0xFF3F7CAC),
  beginner: Color(0xFF6DA06F),
  intermediate: Color(0xFFE09B3D),
  advanced: Color(0xFFCF4C3C),
  gradientStart: Color(0xFFFFF2E5),
  gradientEnd: Color(0xFFF6E6D5),
);

// Warm dark palette — keeps the brand orange, dark cocoa surfaces.
const darkPalette = AppPalette(
  primary: Color(0xFFF98A57),
  primaryLight: Color(0xFFFFB68C),
  primaryDark: Color(0xFFC75A2C),
  accent: Color(0xFF4A3526),
  background: Color(0xFF1C1712),
  backgroundMuted: Color(0xFF221C16),
  surface: Color(0xFF26201A),
  surfaceStrong: Color(0xFF2C251E),
  surfaceLight: Color(0xFF332B23),
  border: Color(0xFF3D3328),
  cardBorder: Color(0xFF3A3127),
  textPrimary: Color(0xFFF3E9DD),
  textSecondary: Color(0xFFC3B4A3),
  textHint: Color(0xFF8C7C6B),
  softShadow: Color(0x33000000),
  success: Color(0xFF4FB97D),
  warning: Color(0xFFE3A93D),
  error: Color(0xFFE2705F),
  info: Color(0xFF6BA3CC),
  beginner: Color(0xFF7FB582),
  intermediate: Color(0xFFE3A93D),
  advanced: Color(0xFFE2705F),
  gradientStart: Color(0xFF241D16),
  gradientEnd: Color(0xFF1A1510),
);

/// Active palette accessor. Same `AppColors.xxx` API as before, now
/// brightness-aware. Call [applyBrightness] before building the widget
/// tree (done in MaterialApp.builder).
class AppColors {
  static AppPalette _p = lightPalette;

  static void applyBrightness(Brightness b) {
    _p = b == Brightness.dark ? darkPalette : lightPalette;
  }

  static Color get primary => _p.primary;
  static Color get primaryLight => _p.primaryLight;
  static Color get primaryDark => _p.primaryDark;
  static Color get accent => _p.accent;
  static Color get background => _p.background;
  static Color get backgroundMuted => _p.backgroundMuted;
  static Color get surface => _p.surface;
  static Color get surfaceStrong => _p.surfaceStrong;
  static Color get surfaceLight => _p.surfaceLight;
  static Color get border => _p.border;
  static Color get cardBorder => _p.cardBorder;
  static Color get textPrimary => _p.textPrimary;
  static Color get textSecondary => _p.textSecondary;
  static Color get textHint => _p.textHint;
  static Color get softShadow => _p.softShadow;
  static Color get success => _p.success;
  static Color get warning => _p.warning;
  static Color get error => _p.error;
  static Color get info => _p.info;
  static Color get beginner => _p.beginner;
  static Color get intermediate => _p.intermediate;
  static Color get advanced => _p.advanced;
  static Color get gradientStart => _p.gradientStart;
  static Color get gradientEnd => _p.gradientEnd;
}
