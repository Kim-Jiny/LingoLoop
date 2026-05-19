# iOS Home Screen Widget — Xcode setup

The Android widget works out of the box. iOS WidgetKit requires a Widget
Extension **target**, which can only be added through Xcode. Do this once:

1. Open `ios/Runner.xcworkspace` in Xcode.
2. **File ▸ New ▸ Target… ▸ Widget Extension**.
   - Product Name: `SentenceWidget`
   - Uncheck "Include Configuration App Intent" / "Include Live Activity".
   - When asked to activate the new scheme, choose **Activate**.
3. Xcode creates a `SentenceWidget` group with a generated `SentenceWidget.swift`
   and `Info.plist`. **Delete the generated `SentenceWidget.swift`** (move to
   trash) and instead **add the existing file** at
   `ios/SentenceWidget/SentenceWidget.swift` to the new target
   (right-click the group ▸ Add Files… ▸ select it ▸ target = SentenceWidget).
4. Add the **App Group** capability to BOTH targets so they share storage:
   - Select the project ▸ target **Runner** ▸ Signing & Capabilities ▸
     **+ Capability ▸ App Groups** ▸ add `group.com.jiny.lingoloop`.
     (Runner.entitlements already declares it — just ensure it is enabled in
     the provisioning profile.)
   - Select target **SentenceWidget** ▸ Signing & Capabilities ▸
     **+ Capability ▸ App Groups** ▸ add `group.com.jiny.lingoloop`.
     Set its entitlements file to `ios/SentenceWidget/SentenceWidget.entitlements`
     (Build Settings ▸ Code Signing Entitlements).
5. Set the SentenceWidget target's iOS Deployment Target to match Runner
   (e.g. iOS 15+). Bundle id will be `com.jiny.lingoloop.SentenceWidget`.
6. Register the App Group on the Apple Developer portal for the
   `com.jiny.lingoloop` App ID if it is not already, then regenerate
   provisioning profiles.

After that: `flutter run`, open the app once (so today's sentence is fetched
and written to the App Group), then long-press the home screen ▸ add the
**오늘의 문장** widget. The Flutter side (`HomeWidgetService`) already pushes
updates whenever the today screen loads — no further code changes needed.

The `@main` lint shown on `SentenceWidget.swift` while it sits outside a target
is expected and disappears once the file belongs to the Widget Extension target.
