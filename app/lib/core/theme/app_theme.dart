import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

class AppTheme {
  static ThemeData get light {
    final base = GoogleFonts.ibmPlexSansKrTextTheme();

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: const ColorScheme(
        brightness: Brightness.light,
        primary: AppColors.primary,
        onPrimary: Colors.white,
        secondary: AppColors.info,
        onSecondary: Colors.white,
        error: AppColors.error,
        onError: Colors.white,
        surface: AppColors.surface,
        onSurface: AppColors.textPrimary,
      ),
      textTheme: base.copyWith(
        displaySmall: GoogleFonts.quicksand(
          fontSize: 36,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
          color: AppColors.textPrimary,
        ),
        headlineLarge: GoogleFonts.ibmPlexSansKr(
          fontSize: 29,
          fontWeight: FontWeight.w700,
          height: 1.3,
          letterSpacing: -0.3,
          color: AppColors.textPrimary,
        ),
        headlineMedium: GoogleFonts.ibmPlexSansKr(
          fontSize: 23,
          fontWeight: FontWeight.w700,
          height: 1.35,
          letterSpacing: -0.3,
          color: AppColors.textPrimary,
        ),
        titleLarge: GoogleFonts.ibmPlexSansKr(
          fontSize: 19,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.2,
          color: AppColors.textPrimary,
        ),
        titleMedium: GoogleFonts.ibmPlexSansKr(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.1,
          color: AppColors.textPrimary,
        ),
        bodyLarge: GoogleFonts.ibmPlexSansKr(
          fontSize: 16,
          height: 1.6,
          color: AppColors.textPrimary,
        ),
        bodyMedium: GoogleFonts.ibmPlexSansKr(
          fontSize: 14,
          height: 1.55,
          color: AppColors.textSecondary,
        ),
        bodySmall: GoogleFonts.ibmPlexSansKr(
          fontSize: 12,
          height: 1.45,
          color: AppColors.textHint,
        ),
      ),
      scaffoldBackgroundColor: AppColors.background,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.ibmPlexSansKr(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surfaceStrong,
        indicatorColor: AppColors.accent,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? AppColors.primary : AppColors.textHint,
          );
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return GoogleFonts.ibmPlexSansKr(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? AppColors.primary : AppColors.textHint,
          );
        }),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          elevation: 2,
          shadowColor: AppColors.softShadow,
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
          foregroundColor: AppColors.primary,
          backgroundColor: AppColors.surface,
          minimumSize: const Size(double.infinity, 54),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(26),
          ),
          side: const BorderSide(color: AppColors.border, width: 1.4),
          textStyle: GoogleFonts.ibmPlexSansKr(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: GoogleFonts.ibmPlexSansKr(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceLight,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(22),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(22),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(22),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(22),
          borderSide: const BorderSide(color: AppColors.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(22),
          borderSide: const BorderSide(color: AppColors.error, width: 2),
        ),
        hintStyle: GoogleFonts.ibmPlexSansKr(color: AppColors.textHint),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 18,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 4,
        shadowColor: AppColors.softShadow,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(26),
          side: const BorderSide(color: AppColors.cardBorder),
        ),
        color: AppColors.surfaceStrong,
        margin: EdgeInsets.zero,
      ),
      dividerColor: AppColors.border,
      splashColor: AppColors.accent.withValues(alpha: 0.4),
      highlightColor: AppColors.accent.withValues(alpha: 0.25),
    );
  }
}
