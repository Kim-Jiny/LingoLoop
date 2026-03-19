import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../data/notification_repository.dart';

final notificationSettingsProvider =
    FutureProvider<NotificationSettingsModel>((ref) async {
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
  bool _isLoading = false;
  bool _initialized = false;

  @override
  Widget build(BuildContext context) {
    final settingsAsync = ref.watch(notificationSettingsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('알림 설정')),
      body: settingsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('오류: $e')),
        data: (settings) {
          if (!_initialized) {
            _isEnabled = settings.isEnabled;
            _frequencyMinutes = settings.frequencyMinutes;
            _startTime = _parseTime(settings.activeStartTime);
            _endTime = _parseTime(settings.activeEndTime);
            _quizRatio = settings.quizPushRatio;
            _initialized = true;
          }
          return _buildSettings();
        },
      ),
    );
  }

  Widget _buildSettings() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Enable/disable
        Card(
          child: SwitchListTile(
            title: const Text('푸시 알림'),
            subtitle: Text(_isEnabled ? '알림이 활성화되어 있습니다' : '알림이 꺼져 있습니다'),
            value: _isEnabled,
            onChanged: (v) => setState(() => _isEnabled = v),
            activeColor: AppColors.primary,
          ),
        ),
        const SizedBox(height: 12),

        // Frequency
        if (_isEnabled) ...[
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('알림 주기',
                      style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    children: [30, 60, 90, 120, 180, 240].map((min) {
                      final isSelected = _frequencyMinutes == min;
                      return ChoiceChip(
                        label: Text(_formatMinutes(min)),
                        selected: isSelected,
                        onSelected: (_) =>
                            setState(() => _frequencyMinutes = min),
                        selectedColor: AppColors.primary.withValues(alpha: 0.2),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Active hours
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('활성 시간대',
                      style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(
                    '이 시간에만 알림이 옵니다',
                    style: TextStyle(
                        color: AppColors.textSecondary, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => _pickTime(true),
                          child: Text(
                              '시작 ${_startTime.format(context)}'),
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Text('~'),
                      ),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => _pickTime(false),
                          child:
                              Text('종료 ${_endTime.format(context)}'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Quiz push ratio
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('퀴즈 알림 비율',
                      style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(
                    '알림 중 퀴즈가 나올 확률: ${(_quizRatio * 100).round()}%',
                    style: TextStyle(
                        color: AppColors.textSecondary, fontSize: 13),
                  ),
                  Slider(
                    value: _quizRatio,
                    min: 0,
                    max: 0.8,
                    divisions: 8,
                    label: '${(_quizRatio * 100).round()}%',
                    onChanged: (v) => setState(() => _quizRatio = v),
                    activeColor: AppColors.primary,
                  ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 24),

        // Save button
        ElevatedButton(
          onPressed: _isLoading ? null : _saveSettings,
          child: _isLoading
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                )
              : const Text('저장'),
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
        quizPushRatio: _quizRatio,
      );
      ref.invalidate(notificationSettingsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('설정이 저장되었습니다')),
        );
        Navigator.of(context).pop();
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
    if (minutes < 60) return '${minutes}분';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return m > 0 ? '${h}시간 ${m}분' : '${h}시간';
  }

  TimeOfDay _parseTime(String time) {
    final parts = time.split(':');
    return TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
  }
}
