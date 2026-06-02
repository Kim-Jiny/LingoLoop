import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity.js';
import { Sentence } from '../sentences/sentence.entity.js';
import { Language } from '../sentences/language.entity.js';

@Entity('ll_vocabulary')
// 다언어 지원 — 한 user가 EN의 'run'과 JA의 'run'을 별도 row로 가질 수
// 있도록 (user_id, language_id, word) 복합 unique. 인덱스는 entity
// 데코레이터로 두면 synchronize가 매 부팅마다 충돌 처리(이름 mismatch)로
// drop & recreate를 시도하므로 onModuleInit의 raw SQL(`CREATE UNIQUE
// INDEX IF NOT EXISTS idx_ll_vocabulary_user_lang_word`)로 일원화.
export class Vocabulary {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Language, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'language_id' })
  language: Language | null;

  /// 다언어 — dev에서 synchronize=on이라 entity가 NOT NULL이면 부팅 시
  /// 기존 row(language_id null) 때문에 ALTER가 실패. 엔티티는 nullable로
  /// 두고, 실제 NOT NULL은 prod synchronize=off 환경에서 onModuleInit
  /// 마이그레이션이 backfill 후 적용. 앱 레벨에선 add() 시 항상 채우므로
  /// 신규 row는 null 되지 않음.
  @Column({ name: 'language_id', type: 'int', nullable: true })
  languageId: number | null;

  @Column('text')
  word: string;

  /**
   * 사전형(원형). 사용자가 "ran"을 북마크하면 baseWord="run".
   * 활용형 사전(ll_word_forms)과의 join 키, 단어장 UI에서 "run의 과거형"
   * 라벨 표시. nullable — 미분류이거나 원형과 동일하면 null로 둠.
   */
  @Column('text', { name: 'baseWord', nullable: true })
  baseWord: string | null;

  /**
   * 어떤 활용형인지. ll_word_forms.forms의 키와 같은 enum.
   * verb: 'base' | 'past' | 'pastParticiple' | 'presentParticiple' | 'thirdPersonSingular'
   * noun: 'singular' | 'plural'
   * adjective: 'base' | 'comparative' | 'superlative'
   * adverb: 'base'
   */
  @Column('text', { nullable: true })
  form: string | null;

  /** 'verb' | 'noun' | 'adjective' | 'adverb' | 'other'. */
  @Column('text', { name: 'partOfSpeech', nullable: true })
  partOfSpeech: string | null;

  @Column('text', { nullable: true })
  meaning: string | null;

  @Column('text', { nullable: true })
  context: string | null;

  @ManyToOne(() => Sentence, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sentence_id' })
  sentence: Sentence;

  @Column({ name: 'sentence_id', type: 'int', nullable: true })
  sentenceId: number | null;

  /** 'learning' (default on bookmark) | 'learned'. Quizzes draw from learning. */
  @Column({ default: 'learning' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
