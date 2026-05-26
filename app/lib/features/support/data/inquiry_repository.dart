import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';

final inquiryRepositoryProvider = Provider<InquiryRepository>((ref) {
  return InquiryRepository(ref.read(dioProvider));
});

class InquiryRepository {
  final Dio _dio;

  InquiryRepository(this._dio);

  Future<void> create({
    required String category,
    required String message,
    String? email,
  }) async {
    await _dio.post(
      ApiConstants.inquiries,
      data: {
        'category': category,
        'message': message,
        if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
      },
    );
  }

  Future<InquiryListResponse> listMine() async {
    final response = await _dio.get(ApiConstants.inquiries);
    return InquiryListResponse.fromJson(response.data);
  }

  Future<void> markRead(int inquiryId) async {
    await _dio.post('${ApiConstants.inquiries}/$inquiryId/read');
  }
}

/// 답변 포함된 사용자 문의 한 건.
class Inquiry {
  final int id;
  final String category;
  final String message;
  final String status; // 'open' | 'answered' | 'closed'
  final DateTime createdAt;
  final String? reply;
  final DateTime? repliedAt;

  /// 답변이 도착했지만 사용자가 아직 확인하지 않음 — UI 배지/dot.
  final bool isUnreadReply;

  const Inquiry({
    required this.id,
    required this.category,
    required this.message,
    required this.status,
    required this.createdAt,
    required this.reply,
    required this.repliedAt,
    required this.isUnreadReply,
  });

  factory Inquiry.fromJson(Map<String, dynamic> j) => Inquiry(
        id: j['id'] as int,
        category: j['category'] as String? ?? 'general',
        message: j['message'] as String? ?? '',
        status: j['status'] as String? ?? 'open',
        createdAt: DateTime.parse(j['createdAt'] as String),
        reply: j['reply'] as String?,
        repliedAt: j['repliedAt'] == null
            ? null
            : DateTime.parse(j['repliedAt'] as String),
        isUnreadReply: j['isUnreadReply'] == true,
      );
}

class InquiryListResponse {
  final List<Inquiry> items;
  final int unreadCount;

  const InquiryListResponse({required this.items, required this.unreadCount});

  factory InquiryListResponse.fromJson(Map<String, dynamic> j) =>
      InquiryListResponse(
        items: (j['items'] as List? ?? [])
            .map((e) => Inquiry.fromJson(e as Map<String, dynamic>))
            .toList(),
        unreadCount: (j['unreadCount'] as int?) ?? 0,
      );
}
