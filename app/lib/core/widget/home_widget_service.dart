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
  // Cache the last payload pushed so repeated calls (e.g. every TodayScreen
  // rebuild on a theme toggle) are no-ops and don't churn the platform
  // channel + native widget reload pipeline.
  static String? _lastSentenceKey;
  static String? _lastVocabKey;

  static Future<void> _ensureInit() async {
    if (_initialized) return;
    await HomeWidget.setAppGroupId(_appGroupId);
    _initialized = true;
  }

  static Future<void> _refresh() => HomeWidget.updateWidget(
    iOSName: _iOSWidgetName,
    androidName: _androidWidgetName,
  );

  /// Ask the OS to redraw the widget without changing the cached data —
  /// used when the app is about to be backgrounded so the user sees the
  /// latest values immediately on the home screen.
  static Future<void> refreshOnly() async {
    try {
      await _ensureInit();
      await _refresh();
    } catch (_) {}
  }

  /// Saves today's sentence with detail (pronunciation / situation) and
  /// asks the OS to redraw the widget. Failures are swallowed so a
  /// missing or not-yet-added widget never breaks the app.
  static Future<void> updateTodaySentence({
    required String text,
    required String translation,
    required String assignedDate,
    String? pronunciation,
    String? situation,
  }) async {
    final key = [
      text,
      translation,
      pronunciation ?? '',
      situation ?? '',
      assignedDate,
    ].join('');
    if (key == _lastSentenceKey) return;
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
      // YYYY-MM-DD in the user's local day (server already returns the
      // assignment date for the user's timezone). The native widget uses
      // this to decide whether the cached sentence is still today's.
      await HomeWidget.saveWidgetData<String>('today_date', assignedDate);
      await _refresh();
      _lastSentenceKey = key;
    } catch (_) {
      // Widget not installed / platform unsupported — ignore.
    }
  }

  /// Saves the saved-vocabulary list (word + meaning + source sentence
  /// + sentence translation) as JSON for the small widget, which rotates
  /// through them one per hour. Both the English sentence and its Korean
  /// translation are shown so the word stays in context.
  ///
  /// Stored shape:
  /// `[{"w":"bus","m":"버스","s":"Where is the bus stop?","t":"버스 정류장이 어디에 있나요?"}, …]`
  static Future<void> updateVocabulary(
    List<({String word, String meaning, String sentence, String translation})> items, {
    int limit = 30,
  }) async {
    final trimmed = items.take(limit).toList();
    final json = jsonEncode([
      for (final v in trimmed)
        {'w': v.word, 'm': v.meaning, 's': v.sentence, 't': v.translation},
    ]);
    final key = '${items.length}$json';
    if (key == _lastVocabKey) return;
    try {
      await _ensureInit();
      await HomeWidget.saveWidgetData<String>('vocab_json', json);
      await HomeWidget.saveWidgetData<String>(
        'vocab_total',
        items.length.toString(),
      );
      await _refresh();
      _lastVocabKey = key;
    } catch (_) {
      // Widget not installed / platform unsupported — ignore.
    }
  }
}
