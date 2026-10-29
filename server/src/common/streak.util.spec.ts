import { computeStreak, weekStartOf } from './streak.util';

// 2026-01-05 는 월요일. 1월 5(월) 6(화) 7(수) 8(목) 9(금) 10(토) 11(일) 12(월)
const MON = '2026-01-05';
const TUE = '2026-01-06';
const WED = '2026-01-07';
const THU = '2026-01-08';
const FRI = '2026-01-09';
const SAT = '2026-01-10';
const SUN = '2026-01-11';
const NEXT_MON = '2026-01-12';
const NEXT_TUE = '2026-01-13';

describe('weekStartOf', () => {
  it('주의 시작은 월요일이다', () => {
    expect(weekStartOf(MON)).toBe(MON);
    expect(weekStartOf(WED)).toBe(MON);
    expect(weekStartOf(SUN)).toBe(MON);
    expect(weekStartOf(NEXT_MON)).toBe(NEXT_MON);
  });
});

describe('computeStreak', () => {
  it('기록이 없으면 0', () => {
    expect(computeStreak([], THU)).toMatchObject({ streak: 0, frozenDates: [] });
  });

  it('오늘만 했으면 1', () => {
    expect(computeStreak([THU], THU).streak).toBe(1);
  });

  it('연속 3일', () => {
    expect(computeStreak([TUE, WED, THU], THU).streak).toBe(3);
  });

  it('오늘 아직 안 했어도 어제까지 이어졌으면 살아 있다', () => {
    expect(computeStreak([TUE, WED], THU).streak).toBe(2);
  });

  it('입력 순서와 중복은 상관없다', () => {
    expect(computeStreak([THU, TUE, WED, WED, THU], THU).streak).toBe(3);
  });

  describe('스트릭 프리즈(주 1회, 딱 하루)', () => {
    it('중간에 하루 빠져도 그 주 프리즈로 이어진다 (월, 수, 목 → 3)', () => {
      const r = computeStreak([MON, WED, THU], THU);
      expect(r.streak).toBe(3);
      expect(r.frozenDates).toEqual([TUE]);
    });

    it('어제 빠졌어도 그제까지 했고 이번 주 프리즈가 남았으면 아직 살아 있다', () => {
      // 오늘 금, 목 빠짐, 수까지 함
      const r = computeStreak([TUE, WED], FRI);
      expect(r.streak).toBe(2);
      expect(r.frozenDates).toEqual([THU]);
    });

    it('이틀 연속 빠지면 프리즈로도 못 잇는다', () => {
      expect(computeStreak([TUE, WED], SAT).streak).toBe(0);
    });

    it('3일 이상 지났으면 0', () => {
      expect(computeStreak([MON], FRI).streak).toBe(0);
    });

    it('같은 주에 빈 날이 두 번이면 두 번째는 잇지 못한다', () => {
      // 월, (화 빠짐), 수, (목 빠짐), 금 → 프리즈는 한 번이라 금, 수만 센다
      const r = computeStreak([MON, WED, FRI], FRI);
      expect(r.streak).toBe(2);
      expect(r.frozenDates).toEqual([THU]);
    });

    it('다른 주의 빈 날은 각각 프리즈가 있다', () => {
      // 지난주 토(빠짐: 토)... 수, 목, (금), ... 로 구성하지 않고 주 경계로 검증:
      // 일(지난주), (월 빠짐=이번주), 화 → 이번 주 프리즈 사용
      // 금(지난주 전 주)은 별도
      const lastWeekFri = '2026-01-02';
      const lastWeekSun = SUN; // 1/11
      // 이번 주(1/12~): 월 빠짐, 화 함 / 지난주: 금(1/9)만 빠짐, 목(1/8)·토(1/10)·일(1/11) 함
      const r = computeStreak(
        ['2026-01-08', '2026-01-10', lastWeekSun, NEXT_TUE],
        NEXT_TUE,
      );
      // 화(1/13) ← 월(1/12) 프리즈(이번 주) ← 일(1/11) ← 토(1/10) ← 금(1/9) 프리즈(지난 주) ← 목(1/8)
      expect(r.streak).toBe(4);
      expect(r.frozenDates.sort()).toEqual(['2026-01-09', NEXT_MON].sort());
      expect(lastWeekFri).toBeDefined();
    });

    it('프리즈가 쓰이지 않은 주는 이번 주 사용 가능으로 표시한다', () => {
      expect(computeStreak([WED, THU], THU).freezeAvailableThisWeek).toBe(true);
    });

    it('이번 주 프리즈를 이미 썼다면 사용 불가로 표시한다', () => {
      const r = computeStreak([MON, WED, THU], THU);
      expect(r.freezeAvailableThisWeek).toBe(false);
    });
  });
});
