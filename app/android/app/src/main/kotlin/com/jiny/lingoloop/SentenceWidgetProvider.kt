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

    // Width (dp) at/above which a "wide" layout is used. 2 cells wide
    // is typically ~140-200dp; 3 cells starts around ~220-260dp.
    // Below this we render the small (rotating-vocab) layout no
    // matter how tall the widget is — content at 2 cells wide gets
    // squashed in the tall layout.
    private val sentenceMinWidthDp = 220

    // Height (dp) at/above which the tall (dual-stacked) layout is
    // used. Below this the wide layout is the single-sentence medium
    // layout. 2 cells tall is ~140dp, 3 cells tall ~220dp+.
    private val tallMinHeightDp = 220

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
        val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)

        val views = when {
            // ≥3 cells wide AND ≥3 cells tall → two stacked cards.
            minWidth >= sentenceMinWidthDp && minHeight >= tallMinHeightDp ->
                buildTall(context, data)
            // ≥3 cells wide but short → single today-sentence card.
            minWidth >= sentenceMinWidthDp ->
                buildSentence(context, data)
            // Anything narrower (2-cell widths regardless of height) →
            // rotating vocab card. The tall layout would overflow
            // horizontally at 2 cells wide.
            else ->
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
        populateSentenceContent(views, data)
        return views
    }

    private fun buildTall(
        context: Context,
        data: SharedPreferences,
    ): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.sentence_widget_tall)
        populateSentenceContent(views, data)
        populateSecondaryCard(views, data)
        return views
    }

    /**
     * Renders the top half of either the medium or tall layout. The
     * layouts share their IDs for the sentence area so a single helper
     * can drive both.
     */
    private fun populateSentenceContent(
        views: RemoteViews,
        data: SharedPreferences,
    ) {
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
            views.setViewVisibility(R.id.widget_word_0, android.view.View.GONE)
            views.setViewVisibility(R.id.widget_word_1, android.view.View.GONE)
            return
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

        // Lesson words (max 2) shown as chips under the sentence.
        val words = parseTodayWords(data.getString("today_words", null))
        val chipContainers = intArrayOf(R.id.widget_word_0, R.id.widget_word_1)
        val chipWordIds = intArrayOf(R.id.widget_word_0_text, R.id.widget_word_1_text)
        val chipMeaningIds =
            intArrayOf(R.id.widget_word_0_meaning, R.id.widget_word_1_meaning)
        for (i in chipContainers.indices) {
            if (i < words.size) {
                views.setViewVisibility(chipContainers[i], android.view.View.VISIBLE)
                views.setTextViewText(chipWordIds[i], words[i].first)
                views.setTextViewText(chipMeaningIds[i], words[i].second)
            } else {
                views.setViewVisibility(chipContainers[i], android.view.View.GONE)
            }
        }
    }

    /**
     * Bottom half of the tall layout: a saved-word card randomly
     * pulled from the vocab pool, with the constraint that it differs
     * from the small widget's current featured word so the two cards
     * never show the same lesson. The pick is seeded by hour-of-epoch
     * so it changes once per hour but stays stable across refreshes
     * inside the same hour (matches the small widget's rotation
     * cadence).
     */
    private fun populateSecondaryCard(
        views: RemoteViews,
        data: SharedPreferences,
    ) {
        val items = parseVocab(data.getString("vocab_json", null))
        if (items.size < 2) {
            views.setViewVisibility(R.id.secondary_card, android.view.View.GONE)
            return
        }
        val hourSlot = (System.currentTimeMillis() / 3_600_000L).toInt()
        val primary = ((hourSlot % items.size) + items.size) % items.size
        // Hour-seeded random pick — deterministic so two refreshes in the
        // same hour show the same word, but distinct from `primary`.
        val rng = java.util.Random(hourSlot.toLong() * 31L + 17L)
        var secondary = rng.nextInt(items.size)
        if (secondary == primary && items.size > 1) {
            secondary = (secondary + 1) % items.size
        }
        val w = items[secondary]
        views.setViewVisibility(R.id.secondary_card, android.view.View.VISIBLE)
        views.setTextViewText(R.id.secondary_word, w.word)
        views.setTextViewText(R.id.secondary_meaning, w.meaning)
        views.setTextViewText(R.id.secondary_sentence, w.sentence)
        if (w.translation.isNotEmpty()) {
            views.setTextViewText(R.id.secondary_translation, w.translation)
            views.setViewVisibility(R.id.secondary_translation, android.view.View.VISIBLE)
        } else {
            views.setViewVisibility(R.id.secondary_translation, android.view.View.GONE)
        }
    }

    private fun parseTodayWords(json: String?): List<Pair<String, String>> {
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
            views.setViewVisibility(R.id.vocab_translation, android.view.View.GONE)
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
        if (featured.translation.isNotEmpty()) {
            views.setViewVisibility(R.id.vocab_translation, android.view.View.VISIBLE)
            views.setTextViewText(R.id.vocab_translation, featured.translation)
        } else {
            views.setViewVisibility(R.id.vocab_translation, android.view.View.GONE)
        }
        return views
    }

    private data class WordCard(
        val word: String,
        val meaning: String,
        val sentence: String,
        val translation: String,
    )

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
                    translation = o.optString("t"),
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }
}
