import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/domain/auth_provider.dart';
import '../../subscription/data/purchase_service.dart';
import '../../subscription/data/subscription_repository.dart';
import '../../subscription/domain/subscription_provider.dart';
import '../data/notification_repository.dart';

final notificationSettingsProvider = FutureProvider<NotificationSettingsModel>((
  ref,
) async {
  final repo = ref.read(notificationRepositoryProvider);
  return repo.getSettings();
});

class NotificationSettingsScreen extends ConsumerStatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  ConsumerState<NotificationSettingsScreen> createState() =>
      _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState
    extends ConsumerState<NotificationSettingsScreen> {
  bool _isEnabled = true;
  int _frequencyMinutes = 60;
  TimeOfDay _startTime = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 22, minute: 0);
  double _quizRatio = 0.3;
  String _targetLanguage = 'en';
  String _nativeLanguage = 'ko';
  bool _isLoading = false;
  bool _initialized = false;

  @override
  Widget build(BuildContext context) {
    final settingsAsync = ref.watch(notificationSettingsProvider);
    final user = ref.watch(authStateProvider).asData?.value;
    final subscriptionAsync = ref.watch(subscriptionStatusProvider);
    final catalogAsync = ref.watch(purchaseCatalogProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('루프 설정')),
      body: settingsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('알림 설정을 불러오지 못했어요.\n$e', textAlign: TextAlign.center),
          ),
        ),
        data: (settings) {
          if (!_initialized) {
            _isEnabled = settings.isEnabled;
            _frequencyMinutes = settings.frequencyMinutes;
            _startTime = _parseTime(settings.activeStartTime);
            _endTime = _parseTime(settings.activeEndTime);
            _quizRatio = settings.quizPushRatio;
            _targetLanguage = user?.targetLanguage ?? 'en';
            _nativeLanguage = user?.nativeLanguage ?? 'ko';
            _initialized = true;
          }
          return _buildSettings(
            settings,
            user,
            subscriptionAsync.asData?.value,
            catalogAsync.asData?.value,
          );
        },
      ),
    );
  }

  Widget _buildSettings(
    NotificationSettingsModel settings,
    dynamic user,
    SubscriptionStatus? subscription,
    PurchaseCatalog? catalog,
  ) {
    final isPremium = subscription?.isPremium ?? user?.isPremium == true;
    final premiumProduct = catalog?.premiumProduct;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
      children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(32),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFFF26B3A), Color(0xFFFFB88A)],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '앱을 열지 않아도\n문장이 계속 스며들게',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: Colors.white,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                '한 줄 문장과 프리미엄 퀴즈 푸시를 섞어서 생활 속 반복을 만드는 핵심 설정입니다.',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Colors.white.withValues(alpha: 0.84),
                ),
              ),
              const SizedBox(height: 18),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _HeaderChip(
                    label: _isEnabled ? '루프 활성화' : '루프 일시정지',
                    icon: _isEnabled
                        ? Icons.notifications_active_rounded
                        : Icons.notifications_off_rounded,
                  ),
                  _HeaderChip(
                    label: '다음 추천 ${_formatMinutes(_frequencyMinutes)}',
                    icon: Icons.repeat_rounded,
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _SettingsSection(
          title: '학습 언어',
          subtitle: '지금은 영어 중심이지만, 확장 가능한 구조로 언어 설정을 저장합니다.',
          child: Column(
            children: [
              DropdownButtonFormField<String>(
                initialValue: _targetLanguage,
                items: _languageItems(),
                decoration: const InputDecoration(labelText: '학습 언어'),
                onChanged: (value) {
                  if (value != null) setState(() => _targetLanguage = value);
                },
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _nativeLanguage,
                items: _languageItems(),
                decoration: const InputDecoration(labelText: '모국어'),
                onChanged: (value) {
                  if (value != null) setState(() => _nativeLanguage = value);
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _SettingsSection(
          title: '프리미엄 학습',
          subtitle: isPremium
              ? '현재 프리미엄 루프가 활성화되어 있습니다.'
              : '스토어 구독으로 퀴즈와 퀴즈 푸시를 활성화할 수 있습니다.',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isPremium ? AppColors.accent : AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Text(
                  isPremium
                      ? '프리미엄 상태: 퀴즈, 퀴즈 푸시, 고급 반복 학습 사용 가능'
                      : '무료 상태: 하루 한 줄 중심. 프리미엄으로 퀴즈와 퀴즈 푸시를 켤 수 있음',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                !((catalog?.isAvailable) ?? false)
                    ? '스토어 결제를 사용할 수 없는 환경입니다. 실기기와 스토어 계정 상태를 확인하세요.'
                    : premiumProduct == null
                    ? '스토어에 `${catalog?.notFoundIds.join(', ') ?? ''}` 상품이 아직 연결되지 않았습니다.'
                    : '상품가: ${premiumProduct.price}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed:
                          _isLoading || isPremium || premiumProduct == null
                          ? null
                          : () async {
                              setState(() => _isLoading = true);
                              try {
                                await ref
                                    .read(purchaseServiceProvider)
                                    .buyPremium(
                                      product: premiumProduct,
                                      onSynced: () async {
                                        await ref
                                            .read(authStateProvider.notifier)
                                            .refreshCurrentUser();
                                        ref.invalidate(
                                          subscriptionStatusProvider,
                                        );
                                      },
                                    );
                              } finally {
                                if (mounted) setState(() => _isLoading = false);
                              }
                            },
                      child: Text(isPremium ? '프리미엄 활성화됨' : '프리미엄 구독하기'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _isLoading
                          ? null
                          : () async {
                              setState(() => _isLoading = true);
                              try {
                                await ref
                                    .read(purchaseServiceProvider)
                                    .restorePurchases(
                                      onSynced: () async {
                                        await ref
                                            .read(authStateProvider.notifier)
                                            .refreshCurrentUser();
                                        ref.invalidate(
                                          subscriptionStatusProvider,
                                        );
                                      },
                                    );
                              } finally {
                                if (mounted) {
                                  setState(() => _isLoading = false);
                                }
                              }
                            },
                      child: const Text('구매 복구'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Card(
          child: SwitchListTile(
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 20,
              vertical: 8,
            ),
            title: const Text('푸시 루프 사용'),
            subtitle: Text(
              _isEnabled ? '정해둔 간격대로 문장을 반복 노출합니다.' : '지금은 어떤 문장도 푸시되지 않습니다.',
            ),
            value: _isEnabled,
            onChanged: (v) => setState(() => _isEnabled = v),
            activeThumbColor: AppColors.primary,
          ),
        ),
        if (_isEnabled) ...[
          const SizedBox(height: 16),
          _SettingsSection(
            title: '반복 주기',
            subtitle: '가볍게 스며들게 할지, 자주 각인시킬지 선택하세요.',
            child: Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [30, 60, 90, 120, 180, 240].map((min) {
                final selected = _frequencyMinutes == min;
                return ChoiceChip(
                  label: Text(_formatMinutes(min)),
                  selected: selected,
                  onSelected: (_) => setState(() => _frequencyMinutes = min),
                  selectedColor: AppColors.accent,
                  labelStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: selected
                        ? AppColors.primaryDark
                        : AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                  side: const BorderSide(color: AppColors.border),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 16),
          _SettingsSection(
            title: '활성 시간대',
            subtitle: '수면 시간이나 업무 시간은 피해 자연스럽게 노출되도록 조절하세요.',
            child: Row(
              children: [
                Expanded(
                  child: _TimeButton(
                    label: '시작',
                    value: _startTime.format(context),
                    onTap: () => _pickTime(true),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _TimeButton(
                    label: '종료',
                    value: _endTime.format(context),
                    onTap: () => _pickTime(false),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _SettingsSection(
            title: '프리미엄 퀴즈 푸시 비율',
            subtitle: isPremium
                ? '문장 푸시 사이에 문제를 얼마나 섞을지 결정합니다.'
                : '프리미엄 활성화 시 조정할 수 있습니다.',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      '${(_quizRatio * 100).round()}%',
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(color: AppColors.primary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _quizRatio < 0.2
                            ? '거의 문장 위주로 보냅니다.'
                            : _quizRatio < 0.5
                            ? '문장과 퀴즈가 적절히 섞입니다.'
                            : '자주 문제를 던져서 기억을 확인합니다.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                  ],
                ),
                Slider(
                  value: _quizRatio,
                  min: 0,
                  max: 0.8,
                  divisions: 8,
                  label: '${(_quizRatio * 100).round()}%',
                  activeColor: AppColors.primary,
                  onChanged: isPremium
                      ? (v) => setState(() => _quizRatio = v)
                      : null,
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '현재 루프 미리보기',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 12),
                _PreviewRow(label: '푸시 상태', value: _isEnabled ? '켜짐' : '꺼짐'),
                const Divider(height: 24),
                _PreviewRow(
                  label: '반복 간격',
                  value: _isEnabled ? _formatMinutes(_frequencyMinutes) : '-',
                ),
                const Divider(height: 24),
                _PreviewRow(
                  label: '활성 시간',
                  value:
                      '${_startTime.format(context)} - ${_endTime.format(context)}',
                ),
                const Divider(height: 24),
                _PreviewRow(
                  label: '다음 예약',
                  value: settings.nextPushAt ?? '서버 계산 후 표시',
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: _isLoading ? null : _saveSettings,
          child: _isLoading
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('루프 저장하기'),
        ),
      ],
    );
  }

  Future<void> _pickTime(bool isStart) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isStart ? _startTime : _endTime,
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startTime = picked;
        } else {
          _endTime = picked;
        }
      });
    }
  }

  Future<void> _saveSettings() async {
    setState(() => _isLoading = true);
    try {
      final repo = ref.read(notificationRepositoryProvider);
      await repo.updateSettings(
        isEnabled: _isEnabled,
        frequencyMinutes: _frequencyMinutes,
        activeStartTime:
            '${_startTime.hour.toString().padLeft(2, '0')}:${_startTime.minute.toString().padLeft(2, '0')}',
        activeEndTime:
            '${_endTime.hour.toString().padLeft(2, '0')}:${_endTime.minute.toString().padLeft(2, '0')}',
        quizPushRatio:
            (ref.read(authStateProvider).asData?.value?.isPremium ?? false)
            ? _quizRatio
            : 0.0,
      );
      await ref
          .read(authStateProvider.notifier)
          .updateProfile(
            targetLanguage: _targetLanguage,
            nativeLanguage: _nativeLanguage,
          );
      ref.invalidate(notificationSettingsProvider);
      ref.invalidate(subscriptionStatusProvider);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('루프 설정이 저장되었습니다')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('저장 실패: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _formatMinutes(int minutes) {
    if (minutes < 60) return '$minutes분마다';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (m == 0) return '$h시간마다';
    return '$h시간 $m분마다';
  }

  TimeOfDay _parseTime(String time) {
    final parts = time.split(':');
    return TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
  }

  List<DropdownMenuItem<String>> _languageItems() {
    const labels = {'en': '영어', 'ko': '한국어', 'ja': '일본어', 'es': '스페인어'};
    return labels.entries
        .map(
          (entry) => DropdownMenuItem<String>(
            value: entry.key,
            child: Text(entry.value),
          ),
        )
        .toList();
  }
}

class _HeaderChip extends StatelessWidget {
  final String label;
  final IconData icon;

  const _HeaderChip({required this.label, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: Colors.white),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsSection extends StatelessWidget {
  final String title;
  final String subtitle;
  final Widget child;

  const _SettingsSection({
    required this.title,
    required this.subtitle,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 16),
            child,
          ],
        ),
      ),
    );
  }
}

class _TimeButton extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback onTap;

  const _TimeButton({
    required this.label,
    required this.value,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: Ink(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 6),
            Text(value, style: Theme.of(context).textTheme.titleMedium),
          ],
        ),
      ),
    );
  }
}

class _PreviewRow extends StatelessWidget {
  final String label;
  final String value;

  const _PreviewRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: Theme.of(context).textTheme.bodyLarge),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
      ],
    );
  }
}
