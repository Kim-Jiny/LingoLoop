import 'dart:convert';

import 'package:home_widget/home_widget.dart';

/// Pushes today's sentence + saved vocabulary to the native home screen
/// widgets (iOS WidgetKit + Android AppWidget).
///
/// Small (2x2) widgets render the saved vocabulary list; medium/large
/// (3x2 / 4x2) widgets render the day's sentence in detail.
class HomeWidgetService {
  HomeWidgetService._();

  /// Shared App Group (iOS) — must match the entitlement on both the
  /// Runner target and the widget extension.
  static const String _appGroupId = 'group.com.jiny.lingoloop';

  /// iOS widget kind (matches the `kind:` string in the SwiftUI widget).
  static const String _iOSWidgetName = 'SentenceWidget';

  /// Android provider class name.
  static const String _androidWidgetName = 'SentenceWidgetProvider';

  static bool _initialized = false;

  static Future<void> _ensureInit() async {
    if (_initialized) return;
    await HomeWidget.setAppGroupId(_appGroupId);
    _initialized = true;
  }

  static Future<void> _refresh() => HomeWidget.updateWidget(
    iOSName: _iOSWidgetName,
    androidName: _androidWidgetName,
  );

  /// Saves today's sentence with detail (pronunciation / situation) and
  /// asks the OS to redraw the widget. Failures are swallowed so a
  /// missing or not-yet-added widget never breaks the app.
  static Future<void> updateTodaySentence({
    required String text,
    required String translation,
    String? pronunciation,
    String? situation,
  }) async {
    try {
      await _ensureInit();
      await HomeWidget.saveWidgetData<String>('today_text', text);
      await HomeWidget.saveWidgetData<String>(
        'today_translation',
        translation,
      );
      await HomeWidget.saveWidgetData<String>(
        'today_pronunciation',
        pronunciation ?? '',
      );
      await HomeWidget.saveWidgetData<String>(
        'today_situation',
        situation ?? '',
      );
      await _refresh();
    } catch (_) {
      // Widget not installed / platform unsupported — ignore.
    }
  }

  /// Saves the saved-vocabulary list (word + meaning pairs) as JSON for
  /// the small widget. Only the first [limit] items are stored.
  static Future<void> updateVocabulary(
    List<({String word, String meaning})> items, {
    int limit = 5,
  }) async {
    try {
      await _ensureInit();
      final trimmed = items.take(limit).toList();
      final json = jsonEncode([
        for (final v in trimmed) {'w': v.word, 'm': v.meaning},
      ]);
      await HomeWidget.saveWidgetData<String>('vocab_json', json);
      await HomeWidget.saveWidgetData<String>(
        'vocab_total',
        items.length.toString(),
      );
      await _refresh();
    } catch (_) {
      // Widget not installed / platform unsupported — ignore.
    }
  }
}
