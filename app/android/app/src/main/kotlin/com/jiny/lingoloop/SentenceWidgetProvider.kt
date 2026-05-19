package com.jiny.lingoloop

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.os.Bundle
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider
import org.json.JSONArray

class SentenceWidgetProvider : HomeWidgetProvider() {

    // Width (dp) at/above which the larger "sentence" layout is used.
    // 2x2 cells are roughly ~180dp wide; 3x2+ are ~270dp+.
    private val sentenceMinWidthDp = 220

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences,
    ) {
        appWidgetIds.forEach { id ->
            render(context, appWidgetManager, id, widgetData)
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle?,
    ) {
        val prefs = context.getSharedPreferences(
            "HomeWidgetPreferences",
            Context.MODE_PRIVATE,
        )
        render(context, appWidgetManager, appWidgetId, prefs)
    }

    private fun render(
        context: Context,
        appWidgetManager: AppWidgetManager,
        widgetId: Int,
        data: SharedPreferences,
    ) {
        val options = appWidgetManager.getAppWidgetOptions(widgetId)
        val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
        val useSentence = minWidth >= sentenceMinWidthDp

        val views = if (useSentence) {
            buildSentence(context, data)
        } else {
            buildVocabulary(context, data)
        }

        val launchIntent = HomeWidgetLaunchIntent.getActivity(
            context,
            MainActivity::class.java,
        )
        views.setOnClickPendingIntent(R.id.widget_root, launchIntent)
        appWidgetManager.updateAppWidget(widgetId, views)
    }

    private fun buildSentence(
        context: Context,
        data: SharedPreferences,
    ): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.sentence_widget)
        val text = data.getString("today_text", null)
        val translation = data.getString("today_translation", null)
        val pron = data.getString("today_pronunciation", null)
        val situation = data.getString("today_situation", null)

        if (text.isNullOrEmpty()) {
            views.setTextViewText(R.id.widget_text, "오늘의 문장을 불러오면 여기에 표시됩니다")
            views.setTextViewText(R.id.widget_translation, "앱을 한 번 열어 주세요")
        } else {
            views.setTextViewText(R.id.widget_text, text)
            views.setTextViewText(R.id.widget_translation, translation ?: "")
        }

        if (!pron.isNullOrEmpty()) {
            views.setTextViewText(R.id.widget_pron, pron)
            views.setViewVisibility(R.id.widget_pron, android.view.View.VISIBLE)
        } else {
            views.setViewVisibility(R.id.widget_pron, android.view.View.GONE)
        }

        if (!situation.isNullOrEmpty()) {
            views.setTextViewText(R.id.widget_situation, "💬 $situation")
            views.setViewVisibility(R.id.widget_situation, android.view.View.VISIBLE)
        } else {
            views.setViewVisibility(R.id.widget_situation, android.view.View.GONE)
        }
        return views
    }

    private fun buildVocabulary(
        context: Context,
        data: SharedPreferences,
    ): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.sentence_widget_small)
        val rowContainers = intArrayOf(R.id.vocab_0, R.id.vocab_1, R.id.vocab_2)
        val rowWords = intArrayOf(R.id.vocab_word_0, R.id.vocab_word_1, R.id.vocab_word_2)
        val rowMeanings =
            intArrayOf(R.id.vocab_meaning_0, R.id.vocab_meaning_1, R.id.vocab_meaning_2)

        val json = data.getString("vocab_json", null)
        val total = data.getString("vocab_total", "0")?.toIntOrNull() ?: 0
        val items = parseVocab(json)

        if (items.isEmpty()) {
            for (c in rowContainers) views.setViewVisibility(c, android.view.View.GONE)
            views.setViewVisibility(R.id.vocab_empty, android.view.View.VISIBLE)
            views.setTextViewText(R.id.vocab_more, "")
            return views
        }

        views.setViewVisibility(R.id.vocab_empty, android.view.View.GONE)
        for (i in rowContainers.indices) {
            if (i < items.size) {
                views.setViewVisibility(rowContainers[i], android.view.View.VISIBLE)
                views.setTextViewText(rowWords[i], items[i].first)
                views.setTextViewText(rowMeanings[i], items[i].second)
            } else {
                views.setViewVisibility(rowContainers[i], android.view.View.GONE)
            }
        }

        val shown = minOf(items.size, rowContainers.size)
        views.setTextViewText(
            R.id.vocab_more,
            if (total > shown) "+${total - shown}개 더 · 총 ${total}개" else "총 ${total}개",
        )
        return views
    }

    private fun parseVocab(json: String?): List<Pair<String, String>> {
        if (json.isNullOrEmpty()) return emptyList()
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                o.optString("w") to o.optString("m")
            }
        } catch (e: Exception) {
            emptyList()
        }
    }
}
