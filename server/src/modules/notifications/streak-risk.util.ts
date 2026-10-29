/**
 * 스트릭 위기 알림 — "오늘 아직 안 했어요, N일 연속이 끊길 수 있어요".
 * 대상 선정 규칙을 DB·시간과 분리해 단위 테스트로 고정한다.
 */

/** 사용자 현지 시간 20:30(포함) ~ 22:00(미포함)에만 보낸다. */
const WINDOW_START_MIN = 20 * 60 + 30;
const WINDOW_END_MIN = 22 * 60;

/** 부담스럽지 않게, 이미 어느 정도 이어 온 사람에게만 보낸다. */
export const STREAK_RISK_MIN_STREAK = 3;

export function isStreakRiskWindow(localMinutesOfDay: number): boolean {
  return (
    localMinutesOfDay >= WINDOW_START_MIN && localMinutesOfDay < WINDOW_END_MIN
  );
}

/** DB 조회 없이 알 수 있는 값들 — 이게 통과해야 비싼 스트릭 쿼리를 돌린다. */
export interface StreakRiskPrecheck {
  alreadySentToday: boolean;
  /** 사용자가 정한 알림 활성 시간대 안인가. */
  inActiveWindow: boolean;
  hasDevice: boolean;
  /** 푸시 루프 사용(설정 isEnabled). */
  pushEnabled: boolean;
}

export function passesStreakRiskPrecheck(i: StreakRiskPrecheck): boolean {
  return (
    i.pushEnabled && i.hasDevice && i.inActiveWindow && !i.alreadySentToday
  );
}

/** 스트릭 상태까지 본 최종 판단. */
export function isStreakAtRisk(streak: number, completedToday: boolean): boolean {
  return !completedToday && streak >= STREAK_RISK_MIN_STREAK;
}

export function buildStreakRiskPayload(streak: number) {
  return {
    title: `🔥 ${streak}일 연속이 끊길 수 있어요`,
    body: '오늘 문장 하나만 학습하면 연속 기록이 이어져요.',
    data: {
      type: 'streak_risk',
      // 탭하면 오늘 화면으로(옛 앱도 이 action을 이해한다).
      action: 'today',
    } as Record<string, string>,
  };
}
