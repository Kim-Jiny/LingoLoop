import { isPermanentTokenError, summarizeErrorCodes } from './fcm-errors.util';

describe('isPermanentTokenError', () => {
  it('등록 해제/무효 토큰은 영구 실패 — 비활성화한다', () => {
    expect(isPermanentTokenError('messaging/registration-token-not-registered')).toBe(true);
    expect(isPermanentTokenError('messaging/invalid-registration-token')).toBe(true);
  });

  it('다른 Firebase 프로젝트의 토큰(mismatched-credential)도 영구 실패다', () => {
    expect(isPermanentTokenError('messaging/mismatched-credential')).toBe(true);
  });

  it('invalid-argument는 푸시 내용 문제일 수도 있어 토큰을 끄지 않는다', () => {
    // 이걸 무효로 보면 payload 오류 한 번에 모든 토큰이 꺼질 수 있다.
    expect(isPermanentTokenError('messaging/invalid-argument')).toBe(false);
  });

  it('일시적 오류는 토큰을 유지한다', () => {
    for (const code of [
      'messaging/server-unavailable',
      'messaging/internal-error',
      'messaging/message-rate-exceeded',
      'messaging/device-message-rate-exceeded',
      'messaging/quota-exceeded',
    ]) {
      expect(isPermanentTokenError(code)).toBe(false);
    }
  });

  it('코드가 없거나 알 수 없으면 유지한다(보수적)', () => {
    expect(isPermanentTokenError(undefined)).toBe(false);
    expect(isPermanentTokenError('weird')).toBe(false);
  });
});

describe('summarizeErrorCodes', () => {
  it('코드별 개수를 처음 나온 순서대로 센다', () => {
    expect(
      summarizeErrorCodes([
        'messaging/internal-error',
        'messaging/internal-error',
        undefined,
        'messaging/invalid-registration-token',
      ]),
    ).toBe('messaging/internal-error×2, unknown×1, messaging/invalid-registration-token×1');
  });
  it('비어 있으면 빈 문자열', () => {
    expect(summarizeErrorCodes([])).toBe('');
  });
});
