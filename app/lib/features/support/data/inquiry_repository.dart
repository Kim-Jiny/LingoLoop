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
}
