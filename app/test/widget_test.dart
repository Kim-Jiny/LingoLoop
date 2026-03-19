import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lingoloop/main.dart';

void main() {
  testWidgets('App renders', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(child: LingoLoopApp()),
    );
    // App should render without crashing
    expect(find.text('LingoLoop'), findsAny);
  });
}
