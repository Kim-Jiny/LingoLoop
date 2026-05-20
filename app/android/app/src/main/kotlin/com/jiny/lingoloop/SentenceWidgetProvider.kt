package com.jiny.lingoloop

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.os.Bundle
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

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
        val assigned = data.getString("today_date", null)

        val isStale = !assigned.isNullOrEmpty() && assigned != currentKstDate()
        val hasData = !text.isNullOrEmpty()

        if (isStale) {
            views.setTextViewText(R.id.widget_text, "새 오늘의 문장이 준비됐어요")
            views.setTextViewText(R.id.widget_translation, "앱을 열어 새 문장을 받아보세요")
            views.setViewVisibility(R.id.widget_pron, android.view.View.GONE)
            views.setViewVisibility(R.id.widget_situation, android.view.View.GONE)
            return views
        }

        if (!hasData) {
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

    private fun currentKstDate(): String {
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        fmt.timeZone = TimeZone.getTimeZone("Asia/Seoul")
        return fmt.format(Date())
    }

    private fun buildVocabulary(
        context: Context,
        data: SharedPreferences,
    ): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.sentence_widget_small)
        val json = data.getString("vocab_json", null)
        val items = parseVocab(json)

        if (items.isEmpty()) {
            views.setViewVisibility(R.id.vocab_word, android.view.View.GONE)
            views.setViewVisibility(R.id.vocab_meaning, android.view.View.GONE)
            views.setViewVisibility(R.id.vocab_sentence, android.view.View.GONE)
            views.setViewVisibility(R.id.vocab_empty, android.view.View.VISIBLE)
            return views
        }

        // Pick by hour-of-epoch so the displayed word changes once an
        // hour and matches the iOS rotation policy.
        val hourSlot = (System.currentTimeMillis() / 3_600_000L).toInt()
        val idx = ((hourSlot % items.size) + items.size) % items.size
        val featured = items[idx]

        views.setViewVisibility(R.id.vocab_empty, android.view.View.GONE)
        views.setViewVisibility(R.id.vocab_word, android.view.View.VISIBLE)
        views.setViewVisibility(R.id.vocab_meaning, android.view.View.VISIBLE)
        views.setTextViewText(R.id.vocab_word, featured.word)
        views.setTextViewText(R.id.vocab_meaning, featured.meaning)
        if (featured.sentence.isNotEmpty()) {
            views.setViewVisibility(R.id.vocab_sentence, android.view.View.VISIBLE)
            views.setTextViewText(R.id.vocab_sentence, featured.sentence)
        } else {
            views.setViewVisibility(R.id.vocab_sentence, android.view.View.GONE)
        }
        return views
    }

    private data class WordCard(val word: String, val meaning: String, val sentence: String)

    private fun parseVocab(json: String?): List<WordCard> {
        if (json.isNullOrEmpty()) return emptyList()
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                WordCard(
                    word = o.optString("w"),
                    meaning = o.optString("m"),
                    sentence = o.optString("s"),
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }
}
