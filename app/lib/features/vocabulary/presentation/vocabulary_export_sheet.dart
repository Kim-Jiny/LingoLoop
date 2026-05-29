import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:app_settings/app_settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:gal/gal.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/theme/app_colors.dart';
import '../domain/vocabulary_model.dart';

/// 단어장 → 공유용 이미지 export.
///
/// 사용자가 두 가지를 선택:
///   - 형태: 정사각형(SNS, 최대 10개) / 세로 긴(인쇄·스토리, 최대 20개)
///   - 모드: 단어+뜻 / 단어만 / 뜻만 (빈칸 학습용)
///
/// 랜덤으로 단어 N개 sample → RepaintBoundary로 위젯 트리 PNG 캡처
/// → 임시 파일 저장 → share_plus의 OS share sheet.
class VocabularyExportSheet extends StatefulWidget {
  final List<VocabularyItem> items;

  const VocabularyExportSheet({super.key, required this.items});

  static Future<void> show(
    BuildContext context, {
    required List<VocabularyItem> items,
  }) {
    // 세로 형태 선택 시 미리보기 비율이 1080:1920 → 폭에 비해 매우
    // 길어서 sheet가 full-screen으로 밀려 올라가던 문제. max 80%로
    // 캡하고 내부 SingleChildScrollView로 스크롤.
    final maxH = MediaQuery.of(context).size.height * 0.8;
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: AppColors.background,
      constraints: BoxConstraints(maxHeight: maxH),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => VocabularyExportSheet(items: items),
    );
  }

  @override
  State<VocabularyExportSheet> createState() => _VocabularyExportSheetState();
}

enum _ExportShape {
  /// 정사각형 1080x1080, 최대 10개. SNS 정사각 피드 최적.
  square(10),
  /// 세로 1080x1920, 최대 20개. 인쇄/스토리 최적.
  vertical(20);

  const _ExportShape(this.maxCount);
  final int maxCount;
}

enum _ExportMode {
  /// 단어 | 뜻 — 학습 끝낸 단어 정리/공유.
  both,
  /// 단어 | (빈칸) — 뜻 가리기, 한국어로 떠올리는 연습.
  wordOnly,
  /// 뜻 | (빈칸) — 단어 가리기, 영작/회상 연습.
  meaningOnly,
}

class _VocabularyExportSheetState extends State<VocabularyExportSheet> {
  final GlobalKey _captureKey = GlobalKey();
  _ExportShape _shape = _ExportShape.square;
  _ExportMode _mode = _ExportMode.both;
  bool _busy = false;
  // 같은 sheet 안에서 모양/모드 바꿔도 같은 random sample 유지하기 위해
  // sample을 한 번 픽해서 보관. 새로 다시 뽑고 싶으면 "다시 뽑기" 버튼.
  late List<VocabularyItem> _sampled;
  // meaning이 비어있는 단어는 뜻 칸이 비어 export로 의미 없음. 미리 필터.
  late List<VocabularyItem> _eligible;

  @override
  void initState() {
    super.initState();
    _eligible = widget.items
        .where((v) => (v.meaning ?? '').trim().isNotEmpty)
        .toList();
    _resample();
  }

  void _resample() {
    final pool = List<VocabularyItem>.from(_eligible)..shuffle();
    _sampled = pool.take(_shape.maxCount).toList();
  }

  /// 위젯 트리 → PNG 바이트. 공유/저장 둘 다 같은 캡처 결과 재사용.
  Future<Uint8List> _captureBytes() async {
    final boundary = _captureKey.currentContext?.findRenderObject()
        as RenderRepaintBoundary?;
    if (boundary == null) throw StateError('boundary not ready');
    // pixelRatio 3.0 — Retina/HiDPI에서도 또렷. 더 올리면 파일 크기↑.
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
        '${dir.path}/vocabulary_${DateTime.now().millisecondsSinceEpoch}.png',
      );
      await file.writeAsBytes(bytes);

      await Share.shareXFiles(
        [XFile(file.path, mimeType: 'image/png')],
        subject: 'LingoLoop 단어장',
      );
      // 공유 끝나도 sheet는 열어둠 — 사용자가 형태/모드 바꿔서
      // 추가로 더 만들거나 사진 저장도 같이 할 수 있게.
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

  Future<void> _saveToGallery() async {
    setState(() => _busy = true);
    try {
      // 권한 확인 — gal API. addOnly로 사진 읽기는 안 함 (저장만).
      // iOS는 한 번 거부하면 requestAccess가 OS dialog를 다시 안 띄우고
      // 즉시 false를 반환 → 사용자는 어디서 권한 켜야 할지 모르고 막힘.
      // 그래서 hasAccess=false 면 requestAccess 시도 → 그래도 false면
      // 설정 안내 dialog로 보내는 흐름.
      final hasAccess = await Gal.hasAccess(toAlbum: false);
      if (!hasAccess) {
        final granted = await Gal.requestAccess(toAlbum: false);
        if (!granted) {
          if (mounted) await _showPermissionDeniedDialog();
          return;
        }
      }
      final bytes = await _captureBytes();
      await Gal.putImageBytes(bytes, name: 'lingoloop_vocabulary');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('사진첩에 저장됐어요.')),
        );
        // sheet는 열어둠 — 다른 형태/모드로 더 만들 수 있게.
      }
    } on GalException catch (e) {
      // gal의 accessDenied — putImageBytes 호출 시점에 권한이 사라진
      // 경우 (사용자가 다른 앱에서 권한 회수 등). hasAccess 체크와
      // putImageBytes 사이 race도 여기로 떨어짐.
      if (mounted) {
        if (e.type == GalExceptionType.accessDenied) {
          await _showPermissionDeniedDialog();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('사진첩 저장 실패: ${e.type.message}')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('사진첩 저장 실패: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// 사진첩 권한 거부 시 설정 이동 안내 dialog. 푸시 권한 흐름과
  /// 동일한 패턴 — OS 다이얼로그를 다시 띄울 수 없으니 설정 화면
  /// 으로 직접 보냄.
  Future<void> _showPermissionDeniedDialog() async {
    final go = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('사진첩 저장 권한이 필요해요'),
        content: const Text(
          '단어장 이미지를 사진첩에 저장하려면 권한을 허용해 주세요.\n'
          '설정 화면을 열어드릴까요?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('나중에'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('설정 열기'),
          ),
        ],
      ),
    );
    if (go == true && mounted) {
      await AppSettings.openAppSettings();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_eligible.isEmpty) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('뜻이 채워진 단어가 없어요',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              '단어장의 뜻을 채운 뒤 다시 시도해 주세요.',
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('닫기'),
            ),
          ],
        ),
      );
    }

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
              '이미지로 내보내기',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 4),
            Text(
              '단어장에서 ${_eligible.length}개 중 랜덤으로 골라 공유 이미지를 만들어요.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 20),
            Text('이미지 형태', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            SegmentedButton<_ExportShape>(
              segments: const [
                ButtonSegment(
                  value: _ExportShape.square,
                  label: Text('정사각 · 10개'),
                  icon: Icon(Icons.crop_square_rounded, size: 18),
                ),
                ButtonSegment(
                  value: _ExportShape.vertical,
                  label: Text('세로 · 20개'),
                  icon: Icon(Icons.crop_portrait_rounded, size: 18),
                ),
              ],
              selected: {_shape},
              onSelectionChanged: (sel) => setState(() {
                _shape = sel.first;
                _resample();
              }),
              showSelectedIcon: false,
            ),
            const SizedBox(height: 16),
            Text('표시 방식', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            SegmentedButton<_ExportMode>(
              segments: const [
                ButtonSegment(value: _ExportMode.both, label: Text('단어+뜻')),
                ButtonSegment(
                  value: _ExportMode.wordOnly,
                  label: Text('단어만'),
                ),
                ButtonSegment(
                  value: _ExportMode.meaningOnly,
                  label: Text('뜻만'),
                ),
              ],
              selected: {_mode},
              onSelectionChanged: (sel) => setState(() => _mode = sel.first),
              showSelectedIcon: false,
            ),
            const SizedBox(height: 20),
            // 미리보기 — 실제 export될 비율 그대로. 화면 폭에 맞춰
            // scale down되어 보임. 캡처 시 pixelRatio로 원본 해상도 확보.
            _ExportPreview(
              captureKey: _captureKey,
              shape: _shape,
              mode: _mode,
              items: _sampled,
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: _busy ? null : () => setState(_resample),
              icon: const Icon(Icons.shuffle_rounded),
              label: const Text('다시 뽑기'),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : _saveToGallery,
                    icon: _busy
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.download_rounded),
                    label: const Text('사진 저장'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
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
                        : const Icon(Icons.share_rounded),
                    label: const Text('공유'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ExportPreview extends StatelessWidget {
  final GlobalKey captureKey;
  final _ExportShape shape;
  final _ExportMode mode;
  final List<VocabularyItem> items;

  const _ExportPreview({
    required this.captureKey,
    required this.shape,
    required this.mode,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    final aspect = shape == _ExportShape.square ? 1.0 : 1080 / 1920;
    // 미리보기는 sheet 가로폭을 꽉 채우고 실제 비율대로 세로 잡음.
    // 세로 형태는 폭의 1.78배로 길어지지만 sheet의 SingleChildScrollView
    // 로 스크롤. 잘려 보이지 않고 전체가 다 보임.
    return AspectRatio(
      aspectRatio: aspect,
      child: RepaintBoundary(
        key: captureKey,
        child: _ExportCanvas(shape: shape, mode: mode, items: items),
      ),
    );
  }
}

class _ExportCanvas extends StatelessWidget {
  final _ExportShape shape;
  final _ExportMode mode;
  final List<VocabularyItem> items;

  const _ExportCanvas({
    required this.shape,
    required this.mode,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFFBF5EC),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'My Vocabulary',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF2D2218),
                  ),
                ),
                Text(
                  '${items.length}개',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF8B6B4F),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Container(
              height: 1,
              color: const Color(0xFFE0D2BD),
            ),
            const SizedBox(height: 6),
            // rows-area 정확한 constraints를 얻기 위해 Expanded 안에서
            // LayoutBuilder. outer constraints 기반의 추정값(헤더/푸터
            // 폰트 의존)은 overflow 유발했었음.
            Expanded(
              child: LayoutBuilder(builder: (context, rowsConstraints) {
                // 한 행이 차지하는 정확한 슬롯 = 가용 높이 / maxCount.
                // row를 이 slotHeight로 고정해야 풀로 채웠을 때 빈 공간
                // 없음. 폰트는 slotHeight 기준이라 단어 수 무관하게 동일.
                // items.length ≤ maxCount 보장돼 있어 overflow 없음.
                final slotHeight = rowsConstraints.maxHeight / shape.maxCount;
                final fontSize = (slotHeight * 0.42).clamp(10.0, 26.0);
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < items.length; i++)
                      SizedBox(
                        height: slotHeight,
                        child: _ExportRow(
                          index: i + 1,
                          item: items[i],
                          mode: mode,
                          fontSize: fontSize,
                        ),
                      ),
                  ],
                );
              }),
            ),
            const SizedBox(height: 4),
            Text(
              'LingoLoop',
              textAlign: TextAlign.right,
              style: theme.textTheme.bodySmall?.copyWith(
                color: const Color(0xFFB58963),
                letterSpacing: 1.5,
                fontSize: 9,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExportRow extends StatelessWidget {
  final int index;
  final VocabularyItem item;
  final _ExportMode mode;
  final double fontSize;

  const _ExportRow({
    required this.index,
    required this.item,
    required this.mode,
    required this.fontSize,
  });

  String? get _leftText {
    switch (mode) {
      case _ExportMode.both:
      case _ExportMode.wordOnly:
        return item.word;
      case _ExportMode.meaningOnly:
        return item.meaning;
    }
  }

  String? get _rightText {
    switch (mode) {
      case _ExportMode.both:
        return item.meaning;
      case _ExportMode.wordOnly:
        return null;
      case _ExportMode.meaningOnly:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final left = _leftText ?? '';
    final right = _rightText;
    return DecoratedBox(
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Color(0xFFE0D2BD), width: 0.5),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: fontSize * 2,
            child: Text(
              '$index.',
              style: TextStyle(
                fontSize: fontSize * 0.7,
                color: const Color(0xFFB58963),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            flex: 5,
            child: Text(
              left,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: fontSize,
                color: const Color(0xFF2D2218),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            flex: 6,
            child: Text(
              right ?? '_______________',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: fontSize * 0.92,
                color: right == null
                    ? const Color(0xFFC9B79C)
                    : const Color(0xFF574131),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
