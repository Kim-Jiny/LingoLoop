import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 사용자별 quiz 진행 상태 — `(userId, quizId)` 단위.
 *
 * `ll_quiz_attempts` 가 모든 시도를 historical row로 쌓는 동안 이
 * 테이블은 가장 최근 attempt / 가장 최근 correct attempt만 derived state
 * 로 유지한다. 매 quiz 조회 endpoint가 이걸로:
 *   1) "오늘 이미 맞춘" quiz 필터 (`lastCorrectAt` 의 user-tz date == today)
 *   2) "오래된 학습 우선" ordering (`lastCorrectAt ASC NULLS FIRST` — 한
 *      번도 안 맞춘 신규 quiz가 최우선, 그 다음 옛날 맞힌 것)
 * 을 한 번에 처리한다. attempts에서 매번 aggregate하는 것보다 indexed
 * scan 한 번이라 quiz fetch hot path 비용이 줄어듦.
 *
 * `lastAttemptAt`은 동일 quiz를 마지막으로 시도한 시각 (정/오답 무관) —
 * 향후 "마지막으로 본 문제부터" 정렬 같은 변형에 활용 가능.
 */
@Entity('ll_quiz_progress')
@Index('ll_quiz_progress_user_quiz_uq', ['userId', 'quizId'], { unique: true })
@Index('ll_quiz_progress_user_lastcorrect_idx', ['userId', 'lastCorrectAt'])
export class QuizProgress {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'varchar' })
  userId: string;

  @Column({ name: 'quiz_id', type: 'int' })
  quizId: number;

  @Column({ name: 'last_attempt_at', type: 'timestamp', nullable: true })
  lastAttemptAt: Date | null;

  @Column({ name: 'last_correct_at', type: 'timestamp', nullable: true })
  lastCorrectAt: Date | null;
}
