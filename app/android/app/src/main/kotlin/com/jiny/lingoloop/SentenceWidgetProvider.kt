package com.jiny.lingoloop

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider

class SentenceWidgetProvider : HomeWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences,
    ) {
        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.sentence_widget).apply {
                val text = widgetData.getString("today_text", null)
                val translation = widgetData.getString("today_translation", null)

                if (text.isNullOrEmpty()) {
                    setTextViewText(R.id.widget_text, "오늘의 문장을 불러오면 여기에 표시됩니다")
                    setTextViewText(R.id.widget_translation, "앱을 한 번 열어 주세요")
                } else {
                    setTextViewText(R.id.widget_text, text)
                    setTextViewText(R.id.widget_translation, translation ?: "")
                }

                val launchIntent = HomeWidgetLaunchIntent.getActivity(
                    context,
                    MainActivity::class.java,
                )
                setOnClickPendingIntent(R.id.widget_root, launchIntent)
            }
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}
