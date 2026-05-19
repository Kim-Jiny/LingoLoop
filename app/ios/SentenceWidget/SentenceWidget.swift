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
    let vocab: [VocabPair]
    let vocabTotal: Int
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SentenceEntry {
        SentenceEntry(
            date: Date(),
            text: "Practice makes progress.",
            translation: "연습이 발전을 만든다.",
            pronunciation: "프랙티스 메익스 프로그레스",
            situation: "스스로를 다독일 때",
            vocab: [VocabPair(word: "progress", meaning: "발전, 진전")],
            vocabTotal: 1
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (SentenceEntry) -> Void) {
        completion(readEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SentenceEntry>) -> Void) {
        let entry = readEntry()
        let next = Calendar.current.date(byAdding: .hour, value: 6, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func readEntry() -> SentenceEntry {
        let d = UserDefaults(suiteName: appGroupId)
        let text = d?.string(forKey: "today_text") ?? "오늘의 문장을 불러오면 여기에 표시됩니다"
        let translation = d?.string(forKey: "today_translation") ?? "앱을 한 번 열어 주세요"
        let pron = d?.string(forKey: "today_pronunciation") ?? ""
        let situation = d?.string(forKey: "today_situation") ?? ""

        var vocab: [VocabPair] = []
        if let json = d?.string(forKey: "vocab_json"),
           let data = json.data(using: .utf8),
           let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: String]] {
            vocab = arr.map { VocabPair(word: $0["w"] ?? "", meaning: $0["m"] ?? "") }
        }
        let total = Int(d?.string(forKey: "vocab_total") ?? "0") ?? vocab.count

        return SentenceEntry(
            date: Date(),
            text: text,
            translation: translation,
            pronunciation: pron,
            situation: situation,
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
        .background(brandGradient)
    }
}

// 3x2 / 4x2 — detailed sentence
struct SentenceView: View {
    let entry: SentenceEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("오늘의 루프")
                .font(.system(size: 11, weight: .bold))
                .tracking(1.2)
                .foregroundColor(.white.opacity(0.85))
            Spacer(minLength: 6)
            Text(entry.text)
                .font(.system(size: 17, weight: .bold))
                .foregroundColor(.white)
                .lineLimit(4)
            if !entry.pronunciation.isEmpty {
                Text(entry.pronunciation)
                    .font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.75))
                    .lineLimit(1)
            }
            Text(entry.translation)
                .font(.system(size: 14))
                .foregroundColor(.white.opacity(0.95))
                .lineLimit(3)
            if !entry.situation.isEmpty {
                Spacer(minLength: 2)
                Text("💬 \(entry.situation)")
                    .font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.7))
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(16)
        .background(brandGradient)
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

@main
struct SentenceWidget: Widget {
    let kind: String = "SentenceWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            if #available(iOS 17.0, *) {
                SentenceWidgetEntryView(entry: entry)
                    .containerBackground(.clear, for: .widget)
            } else {
                SentenceWidgetEntryView(entry: entry)
            }
        }
        .configurationDisplayName("LingoLoop")
        .description("2x2는 저장한 단어장, 3x2·4x2는 오늘의 문장을 보여줍니다.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
