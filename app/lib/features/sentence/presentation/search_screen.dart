import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/domain/auth_provider.dart';
import '../../language/domain/languages.dart';
import '../data/sentence_repository.dart';
import '../domain/sentence_model.dart';

class SentenceSearchScreen extends ConsumerStatefulWidget {
  const SentenceSearchScreen({super.key});

  @override
  ConsumerState<SentenceSearchScreen> createState() =>
      _SentenceSearchScreenState();
}

class _SentenceSearchScreenState
    extends ConsumerState<SentenceSearchScreen> {
  final _controller = TextEditingController();
  List<SeenSentence> _results = [];
  bool _loading = false;
  bool _searched = false;
  String? _errorMessage;
  /// 동시 검색 요청 race 방지용 sequence. 응답이 도착했을 때 자신이
  /// 최신 요청이 아니면 state 업데이트 무시. 사용자가 빠르게 'apple'
  /// 후 'banana' 검색해 첫 응답이 늦게 오면 apple 결과로 banana
  /// 결과를 덮는 버그 방지.
  int _requestSeq = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _run() async {
    final q = _controller.text.trim();
    if (q.isEmpty) return;
    final mySeq = ++_requestSeq;
    setState(() {
      _loading = true;
      _searched = true;
      _errorMessage = null;
    });
    try {
      final r = await ref.read(sentenceRepositoryProvider).search(q);
      if (!mounted || mySeq != _requestSeq) return; // stale 응답 무시
      setState(() => _results = r);
    } catch (_) {
      if (!mounted || mySeq != _requestSeq) return;
      // 진짜 에러 (네트워크/401/5xx)와 "결과 0"을 구분 — 사용자가
      // 재시도 가능한 케이스인지 명확히 알 수 있게.
      setState(() {
        _results = [];
        _errorMessage = '검색에 실패했어요. 잠시 후 다시 시도해주세요.';
      });
    } finally {
      if (mounted && mySeq == _requestSeq) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('문장 검색')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
            child: TextField(
              controller: _controller,
              autofocus: true,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _run(),
              decoration: InputDecoration(
                hintText:
                    '학습한 문장을 ${findLanguage(ref.watch(authStateProvider).asData?.value?.targetLanguage ?? 'en')?.labelKo ?? '영어'}/한글로 검색',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.arrow_forward_rounded),
                  onPressed: _run,
                ),
              ),
            ),
          ),
          if (_loading)
            const Expanded(
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_errorMessage != null)
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _errorMessage!,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: _run,
                        icon: const Icon(Icons.refresh_rounded, size: 16),
                        label: const Text('다시 시도'),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else if (_searched && _results.isEmpty)
            Expanded(
              child: Center(
                child: Text(
                  '검색 결과가 없어요.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            )
          else
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                itemCount: _results.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  final s = _results[i];
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(s.text,
                              style:
                                  Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 6),
                          Text(
                            s.translation,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(color: AppColors.textSecondary),
                          ),
                          if (s.status == 'completed') ...[
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Icon(Icons.check_circle_rounded,
                                    size: 15, color: AppColors.success),
                                const SizedBox(width: 4),
                                Text(
                                  '학습 완료',
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodySmall
                                      ?.copyWith(color: AppColors.success),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
