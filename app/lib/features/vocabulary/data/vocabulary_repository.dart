import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../domain/vocabulary_model.dart';

final vocabularyRepositoryProvider = Provider<VocabularyRepository>((ref) {
  return VocabularyRepository(ref.read(dioProvider));
});

class VocabularyRepository {
  final Dio _dio;

  VocabularyRepository(this._dio);

  Future<VocabularyList> list() async {
    final response = await _dio.get(ApiConstants.vocabulary);
    return VocabularyList.fromJson(response.data);
  }

  Future<VocabularyItem> add({
    required String word,
    String? meaning,
    String? context,
    int? sentenceId,
  }) async {
    final response = await _dio.post(
      ApiConstants.vocabulary,
      data: {
        'word': word,
        'meaning': ?meaning,
        'context': ?context,
        'sentenceId': ?sentenceId,
      },
    );
    return VocabularyItem.fromJson(response.data);
  }

  Future<void> updateStatus(int id, String status) async {
    await _dio.patch(
      '${ApiConstants.vocabulary}/$id',
      data: {'status': status},
    );
  }

  Future<void> remove(int id) async {
    await _dio.delete('${ApiConstants.vocabulary}/$id');
  }

  /// 단어 사전 조회. surface/base 어느 쪽이든 받아 매칭된 entry 반환.
  /// 사전에 없는 단어면 null.
  ///
  /// [lang]을 생략하면 서버가 사용자의 현재 학습 언어를 쓴다. 이전엔 기본값
  /// 'en'을 항상 보내 일본어 학습자도 영어 사전을 조회했다.
  Future<WordFormDetail?> getWordForms(String word, {String? lang}) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.vocabulary}/forms/${Uri.encodeComponent(word)}',
        queryParameters: {'lang': ?lang},
      );
      if (response.data == null) return null;
      return WordFormDetail.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }
}
