import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_tts/flutter_tts.dart';

final ttsServiceProvider = Provider<TtsService>((ref) {
  final service = TtsService();
  ref.onDispose(() => service.dispose());
  return service;
});

/// 학습 언어 코드 → FlutterTts locale id 매핑. 호출자가 user.targetLanguage
/// (예: 'ja') 를 그대로 넘기면 'ja-JP' 등으로 변환. 미지원/누락은 en-US
/// fallback — STT의 동일 패턴과 일치.
String ttsLocaleForCode(String? code) {
  switch (code) {
    case 'ja':
      return 'ja-JP';
    case 'es':
      return 'es-ES';
    case 'ko':
      return 'ko-KR';
    case 'en':
    default:
      return 'en-US';
  }
}

class TtsService {
  final FlutterTts _tts = FlutterTts();
  bool _isInitialized = false;

  Future<void> _init() async {
    if (_isInitialized) return;
    // On iOS the default audio session is `ambient`, which means TTS
    // is silenced by the hardware mute switch and ducked by other
    // audio. Switching to `playback` makes the pronunciation audible
    // even when the user has the side switch flipped to silent — the
    // standard behaviour for a learning app.
    if (Platform.isIOS) {
      try {
        await _tts.setIosAudioCategory(
          IosTextToSpeechAudioCategory.playback,
          [
            IosTextToSpeechAudioCategoryOptions.mixWithOthers,
            IosTextToSpeechAudioCategoryOptions.allowBluetooth,
            IosTextToSpeechAudioCategoryOptions.allowBluetoothA2DP,
          ],
          IosTextToSpeechAudioMode.spokenAudio,
        );
      } catch (_) {
        // Falling back to the default category is fine — the user
        // just hears nothing on silent mode.
      }
    }
    await _tts.setLanguage('en-US');
    await _tts.setSpeechRate(0.45);
    await _tts.setPitch(1.0);
    await _tts.setVolume(1.0);
    _isInitialized = true;
  }

  Future<void> speak(String text, {String language = 'en-US'}) async {
    await _init();
    await _tts.setLanguage(language);
    await _tts.speak(text);
  }

  Future<void> stop() async {
    await _tts.stop();
  }

  void dispose() {
    _tts.stop();
  }
}
