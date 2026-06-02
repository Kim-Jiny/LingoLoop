import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity.js';
import { Language } from '../sentences/language.entity.js';

/// (user_id, language_id) → track 매핑. 사용자가 학습 언어를 전환할 때
/// 이전 언어의 트랙 선택을 잃지 않기 위함.
///
/// 동작:
/// - 사용자가 EN 중급 → JA 회화로 전환: 이 표에 두 row가 누적
/// - 다시 EN으로 돌아오면 row에서 '중급'을 다시 읽어 user.learningTrack 복원
/// - 신규 언어로 처음 전환 시 row 없음 → 트랙 선택 화면으로 redirect
///
/// user.learningTrack은 "현재 target language의 트랙" snapshot 역할.
/// 권위는 이 표에 있음.
@Entity('ll_user_language_tracks')
// (user_id, language_id) 복합 unique는 onModuleInit의
// `CREATE UNIQUE INDEX idx_ll_user_lang_tracks_user_lang` raw SQL로
// 관리. entity 데코레이터 indexes는 매 부팅마다 synchronize가 drop &
// recreate를 시도해 중복/충돌 유발 → 단일 출처로 일원화.
export class UserLanguageTrack {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Language, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'language_id' })
  language: Language;

  @Column({ name: 'language_id', type: 'int' })
  languageId: number;

  @Column({ type: 'varchar' })
  track: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
