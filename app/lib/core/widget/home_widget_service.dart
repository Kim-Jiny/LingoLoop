import 'package:home_widget/home_widget.dart';

/// Pushes today's sentence to the native home screen widgets
/// (iOS WidgetKit + Android AppWidget).
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

  /// Saves today's sentence and asks the OS to redraw the widget.
  /// Safe to call repeatedly; failures are swallowed so a missing or
  /// not-yet-added widget never breaks the app.
  static Future<void> updateTodaySentence({
    required String text,
    required String translation,
    required String assignedDate,
  }) async {
    try {
      await _ensureInit();
      await HomeWidget.saveWidgetData<String>('today_text', text);
      await HomeWidget.saveWidgetData<String>(
        'today_translation',
        translation,
      );
      await HomeWidget.saveWidgetData<String>('today_date', assignedDate);
      await HomeWidget.updateWidget(
        iOSName: _iOSWidgetName,
        androidName: _androidWidgetName,
      );
    } catch (_) {
      // Widget not installed / platform unsupported — ignore.
    }
  }
}
