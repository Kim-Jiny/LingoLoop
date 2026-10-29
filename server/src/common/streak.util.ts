/**
 * 연속 학습(스트릭) 계산 — DB·시간대와 무관한 순수 함수.
 *
 * 날짜는 모두 사용자 시간대 기준 'YYYY-MM-DD' 문자열이다.
 *
 * 스트릭 프리즈: 별도로 저장하는 값 없이 **계산만으로** 적용한다.
 * 규칙 — 한 주(월~일)에 한 번, "딱 하루" 빠진 날은 연속 기록을 끊지 않는다.
 * 빠진 날의 앞뒤 날이 모두 학습한 날이어야 한다(이틀 연속 빠지면 못 잇는다).
 * 프리즈로 이어 준 날은 연속 일수에 더하지 않는다(실제로 학습한 날만 센다).
 */

export interface StreakResult {
  /** 실제로 학습한 날을 센 연속 일수. */
  streak: number;
  /** 프리즈로 이어 준 날들. */
  frozenDates: string[];
  /** 이번 주(오늘이 속한 주)에 프리즈를 아직 쓰지 않았는가. */
  freezeAvailableThisWeek: boolean;
}

function parse(d: string): Date {
  return new Date(`${d}T00:00:00.000Z`);
}

function format(t: Date): string {
  return t.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  const t = parse(d);
  t.setUTCDate(t.getUTCDate() + n);
  return format(t);
}

/** 해당 날짜가 속한 주의 월요일 날짜. 프리즈 "주" 구분 키로 쓴다. */
export function weekStartOf(d: string): string {
  const t = parse(d);
  const sinceMonday = (t.getUTCDay() + 6) % 7; // 월=0 … 일=6
  t.setUTCDate(t.getUTCDate() - sinceMonday);
  return format(t);
}

export function computeStreak(
  completedDates: Iterable<string>,
  today: string,
): StreakResult {
  const done = new Set(completedDates);
  const usedWeeks = new Set<string>();
  const frozenDates: string[] = [];

  const result = (streak: number): StreakResult => ({
    streak,
    frozenDates,
    freezeAvailableThisWeek: !usedWeeks.has(weekStartOf(today)),
  });

  if (done.size === 0) return result(0);

  // 시작점: 오늘 → 어제 → (어제 하루 빠진 경우) 그제.
  const yesterday = addDays(today, -1);
  let p: string;
  if (done.has(today)) {
    p = today;
  } else if (done.has(yesterday)) {
    p = yesterday;
  } else {
    const dayBefore = addDays(today, -2);
    if (done.has(dayBefore)) {
      // 어제 하루만 빠졌다 — 이번 주 프리즈로 아직 살아 있다. 오늘 안에
      // 학습하면 이어지고, 못 하면 내일부터는 끊긴다.
      usedWeeks.add(weekStartOf(yesterday));
      frozenDates.push(yesterday);
      p = dayBefore;
    } else {
      return result(0);
    }
  }

  let streak = 1;
  for (;;) {
    const prev = addDays(p, -1);
    if (done.has(prev)) {
      streak++;
      p = prev;
      continue;
    }
    // prev 하루만 빠졌고 그 앞날은 했다면, 그 주의 프리즈가 남았을 때 잇는다.
    const beforePrev = addDays(p, -2);
    const week = weekStartOf(prev);
    if (done.has(beforePrev) && !usedWeeks.has(week)) {
      usedWeeks.add(week);
      frozenDates.push(prev);
      streak++;
      p = beforePrev;
      continue;
    }
    break;
  }

  return result(streak);
}
