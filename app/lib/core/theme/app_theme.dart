import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

class AppTheme {
  static ThemeData get light => _themeFor(lightPalette, Brightness.light);
  static ThemeData get dark => _themeFor(darkPalette, Brightness.dark);

  static ThemeData _themeFor(AppPalette p, Brightness brightness) {
    final base = GoogleFonts.ibmPlexSansKrTextTheme(
      brightness == Brightness.dark
          ? ThemeData(brightness: Brightness.dark).textTheme
          : null,
    );
    final onBrand = Colors.white;

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: ColorScheme(
        brightness: brightness,
        primary: p.primary,
        onPrimary: onBrand,
        secondary: p.info,
        onSecondary: onBrand,
        error: p.error,
        onError: onBrand,
        surface: p.surface,
        onSurface: p.textPrimary,
      ),
      textTheme: base.copyWith(
        displaySmall: GoogleFonts.quicksand(
          fontSize: 36,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
          color: p.textPrimary,
        ),
        headlineLarge: GoogleFonts.ibmPlexSansKr(
          fontSize: 29,
          fontWeight: FontWeight.w700,
          height: 1.3,
          letterSpacing: -0.3,
          color: p.textPrimary,
        ),
        headlineMedium: GoogleFonts.ibmPlexSansKr(
          fontSize: 23,
          fontWeight: FontWeight.w700,
          height: 1.35,
          letterSpacing: -0.3,
          color: p.textPrimary,
        ),
        titleLarge: GoogleFonts.ibmPlexSansKr(
          fontSize: 19,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.2,
          color: p.textPrimary,
        ),
        titleMedium: GoogleFonts.ibmPlexSansKr(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.1,
          color: p.textPrimary,
        ),
        bodyLarge: GoogleFonts.ibmPlexSansKr(
          fontSize: 16,
          height: 1.6,
          color: p.textPrimary,
        ),
        bodyMedium: GoogleFonts.ibmPlexSansKr(
          fontSize: 14,
          height: 1.55,
          color: p.textSecondary,
        ),
        bodySmall: GoogleFonts.ibmPlexSansKr(
          fontSize: 12,
          height: 1.45,
          color: p.textHint,
        ),
      ),
      scaffoldBackgroundColor: p.background,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: p.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        // 라이트 테마: 상태바 아이콘/시간을 dark로 (밝은 크림 배경에 잘
        // 보이게). 다크 테마: light. AppBar는 자체 systemOverlayStyle을
        // AnnotatedRegion으로 push해서 root AnnotatedRegion을 덮어씀 →
        // 여기서 직접 지정 안 하면 transparent bg 기반 default가 적용돼
        // iOS에서 light(흰색) 아이콘으로 떨어지는 케이스 있음.
        systemOverlayStyle: brightness == Brightness.light
            ? const SystemUiOverlayStyle(
                statusBarColor: Colors.transparent,
                statusBarBrightness: Brightness.light, // iOS
                statusBarIconBrightness: Brightness.dark, // Android
                systemNavigationBarIconBrightness: Brightness.dark,
              )
            : const SystemUiOverlayStyle(
                statusBarColor: Colors.transparent,
                statusBarBrightness: Brightness.dark,
                statusBarIconBrightness: Brightness.light,
                systemNavigationBarIconBrightness: Brightness.light,
              ),
        titleTextStyle: GoogleFonts.ibmPlexSansKr(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: p.textPrimary,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: p.surfaceStrong,
        indicatorColor: p.accent,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? p.primary : p.textHint,
          );
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return GoogleFonts.ibmPlexSansKr(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? p.primary : p.textHint,
          );
        }),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: p.primary,
          foregroundColor: onBrand,
          elevation: 2,
          shadowColor: p.softShadow,
          minimumSize: const Size(double.infinity, 56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(26),
          ),
          textStyle: GoogleFonts.ibmPlexSansKr(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.1,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: p.primary,
          backgroundColor: p.surface,
          minimumSize: const Size(double.infinity, 54),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(26),
          ),
          side: BorderSide(color: p.border, width: 1.4),
          textStyle: GoogleFonts.ibmPlexSansKr(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: p.primary,
          textStyle: GoogleFonts.ibmPlexSansKr(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: p.surfaceLight,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(22),
          borderSide: BorderSide(color: p.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(22),
          borderSide: BorderSide(color: p.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(22),
          borderSide: BorderSide(color: p.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(22),
          borderSide: BorderSide(color: p.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(22),
          borderSide: BorderSide(color: p.error, width: 2),
        ),
        hintStyle: GoogleFonts.ibmPlexSansKr(color: p.textHint),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 18,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 4,
        shadowColor: p.softShadow,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(26),
          side: BorderSide(color: p.cardBorder),
        ),
        color: p.surfaceStrong,
        margin: EdgeInsets.zero,
      ),
      dividerColor: p.border,
      splashColor: p.accent.withValues(alpha: 0.4),
      highlightColor: p.accent.withValues(alpha: 0.25),
    );
  }
}
