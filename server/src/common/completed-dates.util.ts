import { Repository } from 'typeorm';
import { DailyAssignment } from '../modules/sentences/daily-assignment.entity.js';

/// completedAt은 naive timestamp 컬럼이라 node-postgres가 서버 TZ의 wall-clock
/// 으로 저장한다. 사용자 시간대로 날짜를 나누려면 먼저 이 TZ로 해석해야 한다.
/// 잘못 잡으면 저녁 완료가 다음 날로 밀리는 버그가 있었다(progress.service 참고).
export const SERVER_TZ =
  process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

/**
 * 사용자가 문장을 완료한 날짜 목록('YYYY-MM-DD', 사용자 시간대, 중복 제거).
 * 스트릭 계산·위기 알림이 같은 규칙을 쓰도록 한 곳에서 만든다.
 *
 * @param languageId 주어지면 해당 언어 문장만. null/undefined면 전체.
 */
export async function fetchCompletedDates(
  repo: Repository<DailyAssignment>,
  userId: string,
  timezone: string,
  languageId?: number | null,
): Promise<string[]> {
  const dateExpr = `to_char((a.completedAt AT TIME ZONE '${SERVER_TZ}') AT TIME ZONE :tz, 'YYYY-MM-DD')`;
  const qb = repo
    .createQueryBuilder('a')
    .select(`DISTINCT ${dateExpr}`, 'date')
    .where('a.userId = :userId', { userId })
    .andWhere("a.status = 'completed'")
    .andWhere('a.completedAt IS NOT NULL');
  if (languageId != null) {
    qb.andWhere(
      'a.sentenceId IN (SELECT id FROM ll_sentences WHERE language_id = :lid)',
      { lid: languageId },
    );
  }
  const rows = await qb.orderBy('date', 'DESC').setParameter('tz', timezone).getRawMany();
  return rows.map((r) => r.date as string);
}
