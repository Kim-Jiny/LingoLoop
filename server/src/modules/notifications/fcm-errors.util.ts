/**
 * FCM 전송 오류 중 "이 토큰은 앞으로도 영원히 안 된다"를 가려낸다. 영구 실패한
 * 토큰은 비활성화해 이후 푸시에서 빼야 매번 헛되이 시도하지 않는다.
 *
 * 일부러 넣지 않은 것: `messaging/invalid-argument` — 토큰이 아니라 푸시
 * 내용(payload) 문제일 때도 나는 오류라서, 무효로 보면 한 번의 payload
 * 오류로 모든 사용자 토큰이 꺼질 수 있다.
 */
const PERMANENT_TOKEN_ERRORS = new Set<string>([
  'messaging/registration-token-not-registered', // 앱 삭제·토큰 만료
  'messaging/invalid-registration-token', // 토큰 형식이 잘못됨
  'messaging/mismatched-credential', // 다른 Firebase 프로젝트에서 받은 토큰
]);

export function isPermanentTokenError(code: string | undefined): boolean {
  return code != null && PERMANENT_TOKEN_ERRORS.has(code);
}

/** 로그용: 오류 코드별 개수를 "코드×N, ..." 한 줄로. */
export function summarizeErrorCodes(codes: Array<string | undefined>): string {
  const counts = new Map<string, number>();
  for (const c of codes) {
    const key = c ?? 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([k, n]) => `${k}×${n}`).join(', ');
}
