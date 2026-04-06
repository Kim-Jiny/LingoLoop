import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/app_config_repository.dart';

final appRemoteConfigProvider = FutureProvider<AppRemoteConfig>((ref) async {
  final repo = ref.read(appConfigRepositoryProvider);
  return repo.getPublicConfig();
});
