import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/theme/app_colors.dart';
import '../domain/sentence_model.dart';

/// 오늘 문장 이미지 공유 시트.
///
/// 시트 구성:
///   - 정사각 1080×1080 미리보기 (브랜드 그라데이션 + 문장/뜻 + 로고)
///   - 공유 / 사진 저장 두 버튼 (single 캡처 재사용)
///
/// "텍스트만 공유" 자리가 필요하면 share sheet의 native fallback도 같이
/// 보내 — Share.shareXFiles의 text 파라미터로 본문 동봉. 사용자가 카톡
/// 등에 보내면 이미지+텍스트가 함께 전달됨.
class TodayShareSheet extends StatefulWidget {
  final SentenceDetail sentence;

  const TodayShareSheet({super.key, required this.sentence});

  static Future<void> show(
    BuildContext context, {
    required SentenceDetail sentence,
  }) {
    final maxH = MediaQuery.of(context).size.height * 0.85;
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.background,
      constraints: BoxConstraints(maxHeight: maxH),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => TodayShareSheet(sentence: sentence),
    );
  }

  @override
  State<TodayShareSheet> createState() => _TodayShareSheetState();
}

class _TodayShareSheetState extends State<TodayShareSheet> {
  final GlobalKey _captureKey = GlobalKey();
  bool _busy = false;

  Future<Uint8List> _captureBytes() async {
    final boundary = _captureKey.currentContext?.findRenderObject()
        as RenderRepaintBoundary?;
    if (boundary == null) throw StateError('boundary not ready');
    final image = await boundary.toImage(pixelRatio: 3.0);
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    if (byteData == null) throw StateError('encode failed');
    return byteData.buffer.asUint8List();
  }

  Future<void> _share() async {
    setState(() => _busy = true);
    try {
      final bytes = await _captureBytes();
      final dir = await getTemporaryDirectory();
      final file = File(
        '${dir.path}/today_${DateTime.now().millisecondsSinceEpoch}.png',
      );
      await file.writeAsBytes(bytes);
      await Share.shareXFiles(
        [XFile(file.path, mimeType: 'image/png')],
        // 이미지를 지원 안 하는 채널(예: SMS 일부)을 대비해 본문 텍스트도
        // 동봉. 대부분의 SNS/메신저는 이미지 우선, 본문은 캡션으로 사용.
        text:
            '${widget.sentence.text}\n${widget.sentence.translation}\n\n— LingoLoop',
        subject: 'LingoLoop · 오늘의 문장',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('이미지 생성 실패: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text(
              '오늘 문장 공유',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 4),
            Text(
              '아래 이미지가 함께 전송돼요. 본문에는 영어 문장과 뜻이 같이 들어가요.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            // 미리보기 — sheet 폭 풀로, 비율은 1:1. 캡처는 pixelRatio 3.0
            // 으로 1080×1080 해상도 출력.
            AspectRatio(
              aspectRatio: 1,
              child: RepaintBoundary(
                key: _captureKey,
                child: _ShareCanvas(sentence: widget.sentence),
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _busy ? null : _share,
              icon: _busy
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.ios_share_rounded),
              label: const Text('공유'),
            ),
          ],
        ),
      ),
    );
  }
}

/// 공유 이미지 캔버스. 1:1 비율, 따뜻한 그라데이션 + 문장/뜻 + 로고.
/// 폰트 크기는 sheet 폭에 따라 LayoutBuilder가 자동 산정 — 캡처 시
/// pixelRatio 3.0이 곱해져 최종 해상도 확보.
class _ShareCanvas extends StatelessWidget {
  final SentenceDetail sentence;

  const _ShareCanvas({required this.sentence});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFF26B3A), Color(0xFFFFA86E)],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: LayoutBuilder(builder: (context, c) {
        final w = c.maxWidth;
        // 사이즈 비례 — sheet 폭이 작아도 캡처 시 pixelRatio가 키워줌.
        final padding = w * 0.07;
        final quoteSize = w * 0.045;
        final textSize = w * 0.075;
        final translationSize = w * 0.045;
        final brandSize = w * 0.04;
        final tagSize = w * 0.028;

        return Padding(
          padding: EdgeInsets.all(padding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 상단 라벨
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _Chip(
                    label: '오늘의 문장',
                    size: tagSize,
                  ),
                  if (sentence.situation != null)
                    _Chip(
                      label: sentence.situation!,
                      size: tagSize,
                    ),
                ],
              ),
              const Spacer(),
              // 큰 따옴표 장식
              Text(
                '“',
                style: TextStyle(
                  fontSize: quoteSize * 4,
                  height: 0.6,
                  color: Colors.white.withValues(alpha: 0.5),
                  fontWeight: FontWeight.w800,
                ),
              ),
              SizedBox(height: w * 0.01),
              // 영어 문장 — 본문
              Text(
                sentence.text,
                style: TextStyle(
                  fontSize: textSize,
                  height: 1.3,
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              SizedBox(height: w * 0.03),
              // 한국어 뜻
              Text(
                sentence.translation,
                style: TextStyle(
                  fontSize: translationSize,
                  height: 1.4,
                  color: Colors.white.withValues(alpha: 0.92),
                ),
              ),
              const Spacer(),
              Container(
                height: 1,
                color: Colors.white.withValues(alpha: 0.3),
              ),
              SizedBox(height: w * 0.03),
              Row(
                children: [
                  Icon(
                    Icons.auto_stories_rounded,
                    size: brandSize * 1.1,
                    color: Colors.white,
                  ),
                  SizedBox(width: w * 0.02),
                  Text(
                    'LingoLoop',
                    style: TextStyle(
                      fontSize: brandSize,
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '하루 한 문장',
                    style: TextStyle(
                      fontSize: tagSize,
                      color: Colors.white.withValues(alpha: 0.7),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      }),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final double size;

  const _Chip({required this.label, required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: size * 1.0, vertical: size * 0.5),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.22),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: size,
          color: Colors.white,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
