import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../../../core/theme/app_colors.dart';
import '../../auth/domain/auth_provider.dart';

/// 퀴즈 텍스트 입력에 붙는 음성 입력 버튼.
///
/// 동작:
///   - 첫 tap: SpeechToText init + 권한 요청. 거부 시 SnackBar.
///   - 인식 중 tap: 즉시 stop.
///   - 인식 결과는 textController에 채워 넣음 — 사용자가 보고
///     필요하면 수정 후 제출하도록 자동 제출 X.
///   - listening 상태 시각화: 마이크 아이콘 색/배경 변경.
///
/// 음성 인식 locale은 사용자의 학습 언어에 따라 동적으로 결정 — EN이면
/// en_US, JA면 ja_JP. 다언어 사용자가 일본어 학습 중에 영어 인식으로
/// 잘못 채워지지 않도록.
class QuizMicButton extends ConsumerStatefulWidget {
  final TextEditingController controller;
  final bool enabled;

  const QuizMicButton({
    super.key,
    required this.controller,
    this.enabled = true,
  });

  @override
  ConsumerState<QuizMicButton> createState() => _QuizMicButtonState();
}

class _QuizMicButtonState extends ConsumerState<QuizMicButton> {
  final _speech = stt.SpeechToText();
  bool _initialized = false;
  bool _listening = false;
  bool _initFailed = false;
  /// init/listen/stop 진행 중 중복 호출 차단. iOS 첫 init은 1~2초가
  /// 걸려 사용자가 그 사이 다시 탭하면 권한 다이얼로그가 두 번 뜨거나
  /// 두 번째 listen이 첫 번째를 abort시킴.
  bool _busy = false;

  @override
  void dispose() {
    // 위젯 사라질 때 듣는 중이면 cancel — 마이크 자원 즉시 회수.
    if (_listening) {
      _speech.cancel();
    }
    super.dispose();
  }

  Future<void> _toggle() async {
    if (!widget.enabled || _busy) return;
    _busy = true;
    try {
      await _toggleInner();
    } finally {
      _busy = false;
    }
  }

  Future<void> _toggleInner() async {
    if (_listening) {
      await _speech.stop();
      if (mounted) setState(() => _listening = false);
      return;
    }

    if (!_initialized && !_initFailed) {
      final ok = await _speech.initialize(
        onStatus: (status) {
          // listening 종료(timeout / silence / manual stop) 시 UI sync.
          if (!mounted) return;
          if (status == 'notListening' || status == 'done') {
            setState(() => _listening = false);
          }
        },
        onError: (_) {
          if (!mounted) return;
          setState(() => _listening = false);
        },
      );
      if (!mounted) return;
      if (!ok) {
        setState(() => _initFailed = true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('음성 인식을 사용하려면 마이크와 음성 인식 권한이 필요해요.'),
          ),
        );
        return;
      }
      _initialized = true;
    }
    if (_initFailed) return;

    setState(() => _listening = true);
    // 학습 언어에 맞는 locale로 인식. 코드별 매핑은 _localeIdFor.
    final code =
        ref.read(authStateProvider).asData?.value?.targetLanguage ?? 'en';
    await _speech.listen(
      listenOptions: stt.SpeechListenOptions(
        localeId: _localeIdFor(code),
        listenMode: stt.ListenMode.dictation,
        partialResults: true,
        cancelOnError: true,
      ),
      onResult: (result) {
        if (!mounted) return;
        // 매 partial/final 결과로 텍스트필드 갱신 — 사용자가 실시간
        // 으로 인식 진행 상황을 보고 잘못 들었으면 멈추고 다시 시도.
        widget.controller.text = result.recognizedWords;
        widget.controller.selection = TextSelection.fromPosition(
          TextPosition(offset: widget.controller.text.length),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final color = _listening ? AppColors.primary : AppColors.textSecondary;
    return IconButton(
      onPressed: widget.enabled ? _toggle : null,
      tooltip: _listening ? '듣는 중… 탭하면 멈춰요' : '음성으로 답 입력',
      icon: Icon(
        _listening ? Icons.mic_rounded : Icons.mic_none_rounded,
        color: color,
      ),
    );
  }

  /// 학습 언어 코드 → speech_to_text locale id. ttsLocaleForCode와
  /// 동일한 코드 셋 커버 — 미지원은 en_US fallback.
  String _localeIdFor(String code) {
    switch (code) {
      case 'ja':
        return 'ja_JP';
      case 'es':
        return 'es_ES';
      case 'ko':
        return 'ko_KR';
      case 'en':
      default:
        return 'en_US';
    }
  }
}
