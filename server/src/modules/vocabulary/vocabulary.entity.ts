import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity.js';
import { Sentence } from '../sentences/sentence.entity.js';
import { Language } from '../sentences/language.entity.js';

@Entity('ll_vocabulary')
// 다언어 지원 — 한 user가 EN의 'run'과 JA의 'run'을 별도 row로 가질 수
// 있도록 (user_id, language_id, word) 복합 unique. 기존 (user_id, word)
// 인덱스는 vocabulary.service.onModuleInit에서 swap.
@Index(['userId', 'languageId', 'word'], { unique: true })
export class Vocabulary {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Language, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'language_id' })
  language: Language;

  @Column({ name: 'language_id', type: 'int' })
  languageId: number;

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
