import WidgetKit
import SwiftUI

private let appGroupId = "group.com.jiny.lingoloop"

struct SentenceEntry: TimelineEntry {
    let date: Date
    let text: String
    let translation: String
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SentenceEntry {
        SentenceEntry(
            date: Date(),
            text: "Practice makes progress.",
            translation: "연습이 발전을 만든다."
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (SentenceEntry) -> Void) {
        completion(readEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SentenceEntry>) -> Void) {
        let entry = readEntry()
        // Refresh roughly every 6 hours; the app also pushes updates directly.
        let next = Calendar.current.date(byAdding: .hour, value: 6, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func readEntry() -> SentenceEntry {
        let defaults = UserDefaults(suiteName: appGroupId)
        let text = defaults?.string(forKey: "today_text") ?? "오늘의 문장을 불러오면 여기에 표시됩니다"
        let translation = defaults?.string(forKey: "today_translation") ?? "앱을 한 번 열어 주세요"
        return SentenceEntry(date: Date(), text: text, translation: translation)
    }
}

struct SentenceWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("오늘의 루프")
                .font(.system(size: 11, weight: .bold))
                .tracking(1.2)
                .foregroundColor(.white.opacity(0.85))
            Spacer(minLength: 4)
            Text(entry.text)
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(.white)
                .lineLimit(3)
            Text(entry.translation)
                .font(.system(size: 13))
                .foregroundColor(.white.opacity(0.9))
                .lineLimit(2)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(16)
        .background(
            LinearGradient(
                colors: [Color(red: 0.949, green: 0.420, blue: 0.227),
                         Color(red: 1.0, green: 0.659, blue: 0.431)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
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
        .configurationDisplayName("오늘의 문장")
        .description("LingoLoop 오늘의 학습 문장을 홈 화면에서 바로 확인하세요.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
