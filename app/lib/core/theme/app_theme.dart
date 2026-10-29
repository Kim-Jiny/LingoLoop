import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

class AppTheme {
  static ThemeData get light => _themeFor(lightPalette, Brightness.light);
  static ThemeData get dark => _themeFor(darkPalette, Brightness.dark);

  static ThemeData _themeFor(AppPalette p, Brightness brightness) {
    final base = GoogleFonts.gowunDodumTextTheme(
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
        displaySmall: GoogleFonts.jua(
          fontSize: 36,
          fontWeight: FontWeight.w400,
          letterSpacing: 0,
          color: p.textPrimary,
        ),
        headlineLarge: GoogleFonts.jua(
          fontSize: 29,
          fontWeight: FontWeight.w400,
          height: 1.3,
          letterSpacing: 0,
          color: p.textPrimary,
        ),
        headlineSmall: GoogleFonts.jua(
          fontSize: 21,
          fontWeight: FontWeight.w400,
          height: 1.35,
          letterSpacing: 0,
          color: p.textPrimary,
        ),
        headlineMedium: GoogleFonts.jua(
          fontSize: 23,
          fontWeight: FontWeight.w400,
          height: 1.35,
          letterSpacing: 0,
          color: p.textPrimary,
        ),
        titleLarge: GoogleFonts.jua(
          fontSize: 19,
          fontWeight: FontWeight.w400,
          letterSpacing: 0,
          color: p.textPrimary,
        ),
        titleMedium: GoogleFonts.jua(
          fontSize: 16,
          fontWeight: FontWeight.w400,
          letterSpacing: 0,
          color: p.textPrimary,
        ),
        bodyLarge: GoogleFonts.gowunDodum(
          fontSize: 16,
          height: 1.6,
          color: p.textPrimary,
        ),
        bodyMedium: GoogleFonts.gowunDodum(
          fontSize: 14,
          height: 1.55,
          color: p.textSecondary,
        ),
        bodySmall: GoogleFonts.gowunDodum(
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
        titleTextStyle: GoogleFonts.jua(
          fontSize: 18,
          fontWeight: FontWeight.w400,
          color: p.textPrimary,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: p.surfaceStrong,
        indicatorColor: p.accent,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(color: selected ? p.primary : p.textHint);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return GoogleFonts.gowunDodum(
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
          // 카툰풍: 흐린 그림자 대신 또렷한 윤곽선 (CartoonCard와 동일 선색).
          elevation: 0,
          minimumSize: const Size(double.infinity, 56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
            side: BorderSide(
              color: p.textPrimary.withValues(alpha: 0.85),
              width: 2,
            ),
          ),
          textStyle: GoogleFonts.jua(
            fontSize: 16,
            fontWeight: FontWeight.w400,
            letterSpacing: 0,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: p.primary,
          backgroundColor: p.surface,
          minimumSize: const Size(double.infinity, 54),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          side: BorderSide(
            color: p.textPrimary.withValues(alpha: 0.85),
            width: 2,
          ),
          textStyle: GoogleFonts.jua(fontSize: 15, fontWeight: FontWeight.w400),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: p.primary,
          textStyle: GoogleFonts.jua(fontSize: 14, fontWeight: FontWeight.w400),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: p.surfaceLight,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(22),
          borderSide: BorderSide(
            color: p.textPrimary.withValues(alpha: 0.4),
            width: 1.6,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(22),
          borderSide: BorderSide(
            color: p.textPrimary.withValues(alpha: 0.4),
            width: 1.6,
          ),
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
        hintStyle: GoogleFonts.gowunDodum(color: p.textHint),
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
      // 말랑한 카툰 톤의 공통 컴포넌트 — 화면마다 제각각이던 반경/색을
      // 테마로 모아 둔다. (개별 위젯이 직접 지정한 값은 그대로 우선)
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: ZoomPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: p.textPrimary,
        contentTextStyle: GoogleFonts.gowunDodum(
          fontSize: 14,
          color: p.background,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(
            color: p.textPrimary.withValues(alpha: 0.85),
            width: 2,
          ),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: p.surfaceStrong,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(28),
          side: BorderSide(
            color: p.textPrimary.withValues(alpha: 0.85),
            width: 2,
          ),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: p.surfaceStrong,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          side: BorderSide(
            color: p.textPrimary.withValues(alpha: 0.85),
            width: 2,
          ),
        ),
      ),
      // 구분선: 기본값(검정에 가까운 outline)은 카툰 카드 안에서 너무 굵어 보인다.
      dividerTheme: DividerThemeData(color: p.cardBorder, thickness: 1),
      // 탭 목록(단어장 등): 얇은 검은 선 대신 연한 구분선 + 굵고 둥근 밑줄.
      tabBarTheme: TabBarThemeData(
        labelColor: p.primary,
        unselectedLabelColor: p.textHint,
        dividerColor: p.cardBorder,
        indicatorSize: TabBarIndicatorSize.label,
        indicator: UnderlineTabIndicator(
          borderRadius: BorderRadius.circular(3),
          borderSide: BorderSide(color: p.primary, width: 4),
        ),
        labelStyle: GoogleFonts.jua(fontSize: 16, fontWeight: FontWeight.w400),
        unselectedLabelStyle: GoogleFonts.jua(
          fontSize: 16,
          fontWeight: FontWeight.w400,
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: p.surfaceLight,
        selectedColor: p.accent,
        side: BorderSide(
          color: p.textPrimary.withValues(alpha: 0.85),
          width: 1.6,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        labelStyle: GoogleFonts.gowunDodum(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: p.textPrimary,
        ),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: p.primary,
        linearTrackColor: p.accent,
        circularTrackColor: p.accent,
        linearMinHeight: 8,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? Colors.white : p.textHint,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? p.primary : p.border,
        ),
        trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
      ),
      listTileTheme: ListTileThemeData(
        iconColor: p.textSecondary,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
      dividerColor: p.border,
      splashColor: p.accent.withValues(alpha: 0.4),
      highlightColor: p.accent.withValues(alpha: 0.25),
    );
  }
}
