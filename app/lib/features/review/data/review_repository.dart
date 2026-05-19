import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../domain/review_model.dart';

final reviewRepositoryProvider = Provider<ReviewRepository>((ref) {
  return ReviewRepository(ref.read(dioProvider));
});

class ReviewRepository {
  final Dio _dio;

  ReviewRepository(this._dio);

  Future<ReviewQueue> getQueue({int limit = 10}) async {
    final response = await _dio.get(
      ApiConstants.progressReview,
      queryParameters: {'limit': limit},
    );
    return ReviewQueue.fromJson(response.data);
  }
}
