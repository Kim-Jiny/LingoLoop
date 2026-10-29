import {
  isStreakRiskWindow,
  passesStreakRiskPrecheck,
  isStreakAtRisk,
  buildStreakRiskPayload,
} from './streak-risk.util';

describe('isStreakRiskWindow (사용자 현지 20:30 이후 ~ 22:00 전)', () => {
  const at = (h: number, m: number) => h * 60 + m;
  it('20:29는 아직 아니다', () => {
    expect(isStreakRiskWindow(at(20, 29))).toBe(false);
  });
  it('20:30부터 시작', () => {
    expect(isStreakRiskWindow(at(20, 30))).toBe(true);
  });
  it('21:59까지 안', () => {
    expect(isStreakRiskWindow(at(21, 59))).toBe(true);
  });
  it('22:00은 밖', () => {
    expect(isStreakRiskWindow(at(22, 0))).toBe(false);
  });
  it('낮에는 아니다', () => {
    expect(isStreakRiskWindow(at(12, 0))).toBe(false);
  });
});

describe('passesStreakRiskPrecheck', () => {
  const base = {
    alreadySentToday: false,
    inActiveWindow: true,
    hasDevice: true,
    pushEnabled: true,
  };
  it('모두 만족하면 통과', () => {
    expect(passesStreakRiskPrecheck(base)).toBe(true);
  });
  it('오늘 이미 보냈으면 막는다(하루 한 번)', () => {
    expect(passesStreakRiskPrecheck({ ...base, alreadySentToday: true })).toBe(
      false,
    );
  });
  it('알림 활성 시간대 밖이면 막는다', () => {
    expect(passesStreakRiskPrecheck({ ...base, inActiveWindow: false })).toBe(
      false,
    );
  });
  it('기기가 없거나 푸시를 꺼 두면 막는다', () => {
    expect(passesStreakRiskPrecheck({ ...base, hasDevice: false })).toBe(false);
    expect(passesStreakRiskPrecheck({ ...base, pushEnabled: false })).toBe(
      false,
    );
  });
});

describe('isStreakAtRisk', () => {
  it('3일 이상 이어 왔고 오늘 아직이면 위기', () => {
    expect(isStreakAtRisk(3, false)).toBe(true);
    expect(isStreakAtRisk(30, false)).toBe(true);
  });
  it('2일 이하는 부담이라 보내지 않는다', () => {
    expect(isStreakAtRisk(2, false)).toBe(false);
    expect(isStreakAtRisk(0, false)).toBe(false);
  });
  it('오늘 이미 학습했으면 위기가 아니다', () => {
    expect(isStreakAtRisk(10, true)).toBe(false);
  });
});

describe('buildStreakRiskPayload', () => {
  it('연속 일수가 문구에 들어가고 today로 연결된다', () => {
    const p = buildStreakRiskPayload(7);
    expect(p.title).toContain('7일');
    expect(p.data.type).toBe('streak_risk');
    expect(p.data.action).toBe('today');
  });
});
