# iOS Home Screen Widget — `SentenceWidget`

The Widget Extension target was added in Xcode (May 2026). This document
records the wiring so it can be reproduced if the project is rebuilt.

## Target structure

- Target name: **SentenceWidgetExtension** (Product Name: `SentenceWidget`)
- Bundle id: `com.jiny.lingoloop.SentenceWidget`
- App Group (shared with Runner): `group.com.jiny.lingoloop`
- Entitlements file: `ios/SentenceWidgetExtension.entitlements`
- Widget `kind` string (must match Dart side `_iOSWidgetName`): `"SentenceWidget"`

## Files in this folder

- `SentenceWidget.swift` — the widget itself.
  - `systemSmall` (2x2) renders saved vocabulary from the App Group.
  - `systemMedium` / `systemLarge` (3x2 / 4x2) renders today's sentence with
    pronunciation, translation, and situation.
- `SentenceWidgetBundle.swift` — Xcode-generated `@main WidgetBundle`. The
  example `SentenceWidgetControl()` was removed from its body so only the
  real widget is registered.
- `SentenceWidgetControl.swift` — Xcode generated a "Timer" Control Widget
  example here. It was neutralized (emptied to comments) so the build does
  not depend on iOS 18-only ControlWidget APIs.
- `Info.plist`, `Assets.xcassets` — Xcode-generated defaults, untouched.

## Project-level changes already applied

1. **App Group** added to both targets and registered in
   `Runner/Runner.entitlements` (Runner) and
   `ios/SentenceWidgetExtension.entitlements` (extension).
2. **Runner build phase order** — `Embed Foundation Extensions` was moved
   to run before `Thin Binary` and the `[CP]` Pods phases. Without this,
   Xcode emits `Cycle inside Runner; building could produce unreliable
   results`. The current Runner build phase order is:

   1. `[CP] Check Pods Manifest.lock`
   2. `Run Script` (Flutter)
   3. `Sources` / `Frameworks` / `Resources`
   4. `Embed Frameworks`
   5. **`Embed Foundation Extensions`** ← moved here
   6. `Thin Binary`
   7. `[CP] Embed Pods Frameworks`
   8. `[CP] Copy Pods Resources`

## Remaining manual setup for device / TestFlight builds

Simulator builds work as-is. To run on a real device or ship:

- In the Apple Developer portal, register the App Group
  `group.com.jiny.lingoloop` on the `com.jiny.lingoloop` App ID, then add it
  to the `com.jiny.lingoloop.SentenceWidget` App ID as well. Regenerate the
  provisioning profiles so Xcode can sign the entitlement.

## Data contract

`HomeWidgetService` (Dart) writes the following keys into
`UserDefaults(suiteName: "group.com.jiny.lingoloop")`:

| Key                   | Used by         | Notes                              |
|-----------------------|-----------------|------------------------------------|
| `today_text`          | medium / large  | English sentence                   |
| `today_translation`   | medium / large  | Korean translation                 |
| `today_pronunciation` | medium / large  | Korean phonetic gloss              |
| `today_situation`     | medium / large  | One-line situational hint          |
| `vocab_json`          | small           | JSON `[{w,m}, ...]` (up to 5)      |
| `vocab_total`         | small           | Total count of saved vocabulary    |
