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
        SentenceEntry(
            date: Date(),
            text: "Practice makes progress.",
            translation: "연습이 발전을 만든다.",
            pronunciation: "프랙티스 메익스 프로그레스",
            situation: "스스로를 다독일 때",
            assignedDate: kstDateString(Date()),
            isStale: false,
            vocab: [VocabPair(word: "progress", meaning: "발전, 진전")],
            vocabTotal: 1
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (SentenceEntry) -> Void) {
        completion(readEntry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SentenceEntry>) -> Void) {
        let now = Date()
        let midnight = nextKstMidnight(after: now)
        // First entry uses current data; a second entry at the next KST
        // midnight forces the widget to re-evaluate staleness exactly when
        // the day rolls over. Both read from the App Group so the second
        // entry picks up any update the app pushed in between.
        let entries = [readEntry(at: now), readEntry(at: midnight)]
        let next = Calendar.current.date(byAdding: .hour, value: 6, to: midnight) ?? midnight
        completion(Timeline(entries: entries, policy: .after(next)))
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
            vocab = arr.map { VocabPair(word: $0["w"] ?? "", meaning: $0["m"] ?? "") }
        }
        let total = Int(d?.string(forKey: "vocab_total") ?? "0") ?? vocab.count

        return SentenceEntry(
            date: date,
            text: hasData ? text : "오늘의 문장을 불러오면 여기에 표시됩니다",
            translation: hasData ? translation : "앱을 한 번 열어 주세요",
            pronunciation: hasData ? pron : "",
            situation: hasData ? situation : "",
            assignedDate: assigned,
            isStale: stale,
            vocab: vocab,
            vocabTotal: total
        )
    }
}

private let brandGradient = LinearGradient(
    colors: [Color(red: 0.949, green: 0.420, blue: 0.227),
             Color(red: 1.0, green: 0.659, blue: 0.431)],
    startPoint: .topLeading,
    endPoint: .bottomTrailing
)

// 2x2 — saved vocabulary
struct VocabView: View {
    let entry: SentenceEntry

    var body: some View {
        // No .background here — the widget container paints the gradient
        // edge-to-edge so there are no white system margins around it.
        VStack(alignment: .leading, spacing: 6) {
            Text("단어장")
                .font(.system(size: 11, weight: .bold))
                .tracking(1.0)
                .foregroundColor(.white.opacity(0.85))

            if entry.vocab.isEmpty {
                Spacer()
                Text("단어를 저장하면\n여기에 표시됩니다")
                    .font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.85))
                Spacer()
            } else {
                Spacer(minLength: 4)
                ForEach(entry.vocab.prefix(3)) { v in
                    VStack(alignment: .leading, spacing: 1) {
                        Text(v.word)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                            .lineLimit(1)
                        Text(v.meaning)
                            .font(.system(size: 12))
                            .foregroundColor(.white.opacity(0.85))
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                let shown = min(entry.vocab.count, 3)
                Text(entry.vocabTotal > shown
                     ? "+\(entry.vocabTotal - shown)개 더 · 총 \(entry.vocabTotal)개"
                     : "총 \(entry.vocabTotal)개")
                    .font(.system(size: 11))
                    .foregroundColor(.white.opacity(0.7))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(14)
    }
}

// 3x2 / 4x2 — detailed sentence
struct SentenceView: View {
    let entry: SentenceEntry

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
                VStack(alignment: .leading, spacing: 6) {
                    // Sentence must never be truncated. Allow it to wrap
                    // freely and shrink the font down to ~60% if needed.
                    Text(entry.text)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundColor(.white)
                        .lineLimit(nil)
                        .minimumScaleFactor(0.6)
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
                    if !entry.situation.isEmpty {
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

struct SentenceWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: Provider.Entry

    var body: some View {
        switch family {
        case .systemSmall:
            VocabView(entry: entry)
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
