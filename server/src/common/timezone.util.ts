/**
 * Timezone helpers built on Intl (no external deps). The server runs in UTC
 * abroad, so push scheduling must be computed against each user's IANA
 * timezone (e.g. "Asia/Seoul"), not server-local time.
 */

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
}

/** Wall-clock parts of `date` as seen in `timeZone`. */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  let hour = parseInt(map.hour, 10);
  if (hour === 24) hour = 0; // en-US hour12:false reports midnight as 24
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    hour,
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
  };
}

/** Offset in ms such that: tzLocalWallClock = utc + offset. */
function offsetMs(date: Date, timeZone: string): number {
  const z = getZonedParts(date, timeZone);
  const asIfUtc = Date.UTC(
    z.year,
    z.month - 1,
    z.day,
    z.hour,
    z.minute,
    z.second,
  );
  return asIfUtc - date.getTime();
}

/**
 * Given a wall-clock time in `timeZone`, return the matching UTC Date.
 * Two-pass to stay correct across DST boundaries.
 */
export function zonedWallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let result = guessUtc - offsetMs(new Date(guessUtc), timeZone);
  result = guessUtc - offsetMs(new Date(result), timeZone);
  return new Date(result);
}
