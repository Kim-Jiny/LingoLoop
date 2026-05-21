//
//  SentenceWidget.swift
//  SentenceWidget
//
//  LingoLoop home screen widget.
//  2x2 (systemSmall): saved vocabulary list
//  3x2 / 4x2 (systemMedium / systemLarge): today's sentence in detail
//

import WidgetKit
import SwiftUI

private let appGroupId = "group.com.jiny.lingoloop"

struct VocabPair: Identifiable {
    let id = UUID()
    let word: String
    let meaning: String
    let sentence: String
    let translation: String
}

struct SentenceWord: Identifiable {
    let id = UUID()
    let word: String
    let meaning: String
}

struct SentenceEntry: TimelineEntry {
    let date: Date
    let text: String
    let translation: String
    let pronunciation: String
    let situation: String
    let assignedDate: String
    let isStale: Bool
    let vocab: [VocabPair]
    let vocabTotal: Int
    /// Word currently chosen for the small (2x2) widget at `date`'s hour.
    /// Nil when the vocab list is empty.
    let featuredVocab: VocabPair?
    /// Next slot in the same rotation — used by `systemLarge` to render
    /// a second card under today's sentence. Nil when vocab has <2 items
    /// or when the same word would repeat.
    let secondaryVocab: VocabPair?
    /// Words from today's sentence — first two are shown on the medium
    /// and large widgets right below the sentence.
    let sentenceWords: [SentenceWord]
}

private let kstTimeZone = TimeZone(identifier: "Asia/Seoul") ?? .current

private func kstDateString(_ date: Date) -> String {
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = kstTimeZone
    let c = cal.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

private func nextKstMidnight(after date: Date) -> Date {
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = kstTimeZone
    var c = cal.dateComponents([.year, .month, .day], from: date)
    c.day = (c.day ?? 0) + 1
    c.hour = 0
    c.minute = 0
    c.second = 1
    return cal.date(from: c) ?? date.addingTimeInterval(3600)
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SentenceEntry {
        let sample = VocabPair(
            word: "progress",
            meaning: "발전, 진전",
            sentence: "Practice makes progress.",
            translation: "연습이 발전을 만든다."
        )
        return SentenceEntry(
            date: Date(),
            text: "Practice makes progress.",
            translation: "연습이 발전을 만든다.",
            pronunciation: "프랙티스 메익스 프로그레스",
            situation: "스스로를 다독일 때",
            assignedDate: kstDateString(Date()),
            isStale: false,
            vocab: [sample],
            vocabTotal: 1,
            featuredVocab: sample,
            secondaryVocab: nil,
            sentenceWords: [
                SentenceWord(word: "progress", meaning: "발전, 진전"),
                SentenceWord(word: "practice", meaning: "연습")
            ]
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (SentenceEntry) -> Void) {
        completion(readEntry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SentenceEntry>) -> Void) {
        // We want the small widget to swap to a new word every hour and
        // the medium/large widget to flip the "stale" state exactly at
        // KST midnight. Emit one entry per upcoming hour for the next 24h
        // so WidgetKit doesn't need to wake the app to advance the word.
        let now = Date()
        var entries: [SentenceEntry] = [readEntry(at: now)]
        let cal = Calendar.current
        // Snap to the next hour boundary.
        var nextHour = cal.nextDate(
            after: now,
            matching: DateComponents(minute: 0, second: 0),
            matchingPolicy: .nextTime
        ) ?? now.addingTimeInterval(3600)
        for _ in 0..<24 {
            entries.append(readEntry(at: nextHour))
            nextHour = cal.date(byAdding: .hour, value: 1, to: nextHour) ?? nextHour
        }
        // Refresh the timeline 25h out so we always have something queued.
        let refreshAt = cal.date(byAdding: .hour, value: 25, to: now) ?? now
        completion(Timeline(entries: entries, policy: .after(refreshAt)))
    }

    private func readEntry(at date: Date) -> SentenceEntry {
        let d = UserDefaults(suiteName: appGroupId)
        let text = d?.string(forKey: "today_text") ?? ""
        let translation = d?.string(forKey: "today_translation") ?? ""
        let pron = d?.string(forKey: "today_pronunciation") ?? ""
        let situation = d?.string(forKey: "today_situation") ?? ""
        let assigned = d?.string(forKey: "today_date") ?? ""

        let todayKst = kstDateString(date)
        let stale = !assigned.isEmpty && assigned != todayKst
        let hasData = !text.isEmpty

        var vocab: [VocabPair] = []
        if let json = d?.string(forKey: "vocab_json"),
           let data = json.data(using: .utf8),
           let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: String]] {
            vocab = arr.map { item in
                VocabPair(
                    word: item["w"] ?? "",
                    meaning: item["m"] ?? "",
                    sentence: item["s"] ?? "",
                    translation: item["t"] ?? ""
                )
            }
        }
        let total = Int(d?.string(forKey: "vocab_total") ?? "0") ?? vocab.count

        var sentenceWords: [SentenceWord] = []
        if let json = d?.string(forKey: "today_words"),
           let data = json.data(using: .utf8),
           let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: String]] {
            sentenceWords = arr.map { item in
                SentenceWord(word: item["w"] ?? "", meaning: item["m"] ?? "")
            }
        }

        // Pick the featured word from the hour-of-epoch so iOS and the app
        // agree on the rotation and so every hourly entry shows a
        // different word.
        var featured: VocabPair? = nil
        var secondary: VocabPair? = nil
        if !vocab.isEmpty {
            let hourSlot = Int(date.timeIntervalSince1970 / 3600)
            let primaryIdx = ((hourSlot % vocab.count) + vocab.count) % vocab.count
            featured = vocab[primaryIdx]
            if vocab.count >= 2 {
                // Hour-seeded pick distinct from primary. The formula
                // is intentionally simple integer arithmetic so iOS and
                // Android compute the same index for the same hour —
                // the previous murmur-style hash on iOS and
                // java.util.Random on Android disagreed on the picks.
                let mixed = ((hourSlot &* 7) &+ 3) % vocab.count
                var idx = mixed >= 0 ? mixed : mixed + vocab.count
                if idx == primaryIdx { idx = (idx + 1) % vocab.count }
                secondary = vocab[idx]
            }
        }

        return SentenceEntry(
            date: date,
            text: hasData ? text : "오늘의 문장을 불러오면 여기에 표시됩니다",
            translation: hasData ? translation : "앱을 한 번 열어 주세요",
            pronunciation: hasData ? pron : "",
            situation: hasData ? situation : "",
            assignedDate: assigned,
            isStale: stale,
            vocab: vocab,
            vocabTotal: total,
            featuredVocab: featured,
            secondaryVocab: secondary,
            sentenceWords: sentenceWords
        )
    }
}

private let brandGradient = LinearGradient(
    colors: [Color(red: 0.949, green: 0.420, blue: 0.227),
             Color(red: 1.0, green: 0.659, blue: 0.431)],
    startPoint: .topLeading,
    endPoint: .bottomTrailing
)

// 2x2 — featured saved word for the current hour, plus the sentence
// that word was bookmarked from with its translation.
struct VocabView: View {
    let entry: SentenceEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let v = entry.featuredVocab {
                Text(v.word)
                    .font(.system(size: 22, weight: .heavy))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Text(v.meaning)
                    .font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.9))
                    .lineLimit(1)
                if !v.sentence.isEmpty {
                    Spacer(minLength: 6)
                    Text(v.sentence)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white)
                        .lineLimit(3)
                        .minimumScaleFactor(0.75)
                        .fixedSize(horizontal: false, vertical: true)
                    if !v.translation.isEmpty {
                        Text(v.translation)
                            .font(.system(size: 11))
                            .foregroundColor(.white.opacity(0.78))
                            .lineLimit(2)
                            .minimumScaleFactor(0.8)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 0)
            } else {
                Spacer()
                Text("단어를 저장하면\n여기에 표시됩니다")
                    .font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.85))
                Spacer()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(14)
    }
}

// 3x2 / 4x2 — detailed sentence with up to 2 lesson words.
struct SentenceView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SentenceEntry

    @ViewBuilder
    private func chipView(_ w: SentenceWord) -> some View {
        HStack(spacing: 6) {
            Text(w.word)
                .font(.system(size: 12, weight: .heavy))
                .foregroundColor(.white)
                .lineLimit(1)
            Text(w.meaning)
                .font(.system(size: 11))
                .foregroundColor(.white.opacity(0.85))
                .lineLimit(1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 999)
                .fill(Color.white.opacity(0.18))
        )
    }

    var body: some View {
        Group {
            if entry.isStale {
                VStack(alignment: .leading, spacing: 8) {
                    Text("새 오늘의 문장이 준비됐어요")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                    Text("앱을 열어 새 문장을 받아보세요")
                        .font(.system(size: 13))
                        .foregroundColor(.white.opacity(0.9))
                    Spacer(minLength: 0)
                }
            } else {
                VStack(alignment: .leading, spacing: 5) {
                    // Sentence — bumped up from 17 → 20pt, never truncates.
                    Text(entry.text)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(.white)
                        .lineLimit(nil)
                        .minimumScaleFactor(0.55)
                        .fixedSize(horizontal: false, vertical: true)
                    if !entry.pronunciation.isEmpty {
                        Text(entry.pronunciation)
                            .font(.system(size: 12))
                            .foregroundColor(.white.opacity(0.75))
                            .lineLimit(1)
                    }
                    Text(entry.translation)
                        .font(.system(size: 14))
                        .foregroundColor(.white.opacity(0.95))
                        .lineLimit(nil)
                        .minimumScaleFactor(0.7)
                        .fixedSize(horizontal: false, vertical: true)

                    // Up to 2 lesson words — chip-style row, sits right
                    // below the sentence so the learner sees the
                    // vocabulary tied to today's text.
                    let pickedWords = Array(entry.sentenceWords.prefix(2))
                    if !pickedWords.isEmpty {
                        Spacer(minLength: 2)
                        // Try one row; fall back to a stacked column only
                        // when the chips don't fit. ViewThatFits walks
                        // the children top-down and picks the first one
                        // whose ideal size fits the parent.
                        ViewThatFits(in: .horizontal) {
                            HStack(spacing: 6) {
                                ForEach(pickedWords) { w in chipView(w) }
                                Spacer(minLength: 0)
                            }
                            VStack(alignment: .leading, spacing: 4) {
                                ForEach(pickedWords) { w in chipView(w) }
                            }
                        }
                    }

                    // Situation footer is the lowest-priority line.
                    // The 4x2 (systemMedium) is short enough that adding
                    // it pushes the rest into truncation — only render
                    // it on systemLarge (and as the medium part of the
                    // tall variant, which is the larger family).
                    if family != .systemMedium && !entry.situation.isEmpty {
                        Spacer(minLength: 2)
                        Text("💬 \(entry.situation)")
                            .font(.system(size: 12))
                            .foregroundColor(.white.opacity(0.7))
                            .lineLimit(2)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(16)
    }
}

// systemLarge — today's sentence on top, a second saved-word card
// underneath (the next slot in the same hourly rotation as the 2x2).
struct LargeView: View {
    let entry: SentenceEntry

    var body: some View {
        VStack(spacing: 0) {
            SentenceView(entry: entry)
                .frame(maxHeight: .infinity)
            if let v = entry.secondaryVocab {
                Rectangle()
                    .fill(Color.white.opacity(0.18))
                    .frame(height: 1)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(v.word)
                            .font(.system(size: 18, weight: .heavy))
                            .foregroundColor(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                        Text(v.meaning)
                            .font(.system(size: 12))
                            .foregroundColor(.white.opacity(0.85))
                            .lineLimit(1)
                        Spacer(minLength: 0)
                    }
                    if !v.sentence.isEmpty {
                        Text(v.sentence)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.white)
                            .lineLimit(2)
                            .minimumScaleFactor(0.8)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if !v.translation.isEmpty {
                        Text(v.translation)
                            .font(.system(size: 11))
                            .foregroundColor(.white.opacity(0.78))
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
        }
    }
}

struct SentenceWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: Provider.Entry

    var body: some View {
        switch family {
        case .systemSmall:
            VocabView(entry: entry)
        case .systemLarge:
            LargeView(entry: entry)
        default:
            SentenceView(entry: entry)
        }
    }
}

struct SentenceWidget: Widget {
    let kind: String = "SentenceWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            SentenceWidgetEntryView(entry: entry)
                .containerBackground(for: .widget) { brandGradient }
        }
        .configurationDisplayName("LingoLoop")
        .description("2x2는 저장한 단어장, 3x2·4x2는 오늘의 문장을 보여줍니다.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}
