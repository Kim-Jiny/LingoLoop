import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * 한 번이라도 달성한 업적을 영구 기록. 사용자가 streak를 잃거나
 * 단어를 지워서 현재 상태가 target 아래로 떨어져도 "이미 따 놓은"
 * 업적은 잠기지 않게 보장 — 게임 식 sticky badge.
 *
 * 매번 getAchievements에서 current >= target이면 INSERT IGNORE해서
 * 처음 달성 시점에 한 줄이 남고, 이후 동일 호출은 충돌로 no-op.
 * (userId, code)에 UNIQUE 제약을 둬서 이걸 보장.
 */
@Entity('ll_achievement_unlocks')
@Unique('ll_achv_unlocks_user_code_uq', ['userId', 'code'])
export class AchievementUnlock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'varchar' })
  @Index('ll_achv_unlocks_user_idx')
  userId: string;

  /** sentences_10 / streak_7 처럼 코드. defs에 정의된 값과 1:1. */
  @Column({ type: 'varchar' })
  code: string;

  @CreateDateColumn({ name: 'unlocked_at' })
  unlockedAt: Date;
}
