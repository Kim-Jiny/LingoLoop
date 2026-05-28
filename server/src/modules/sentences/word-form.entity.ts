import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Language } from './language.entity.js';

/**
 * 단어의 활용형 + 예문 사전. 전역 테이블 — (baseWord, languageId)당 한 행.
 * ll_words(콘텐츠 카드)와 ll_vocabulary(유저 저장 단어)가 공통으로 참조해서
 * "run / ran / running" 같은 활용형을 한 곳에서 보여주고, 사용자가 어떤
 * 활용형으로 검색해도 원형으로 매칭해 sample 문장을 찾을 수 있게 함.
 *
 * 채우는 방식: backstage 단어 페이지에서 "데이터 채우기" → AI 프롬프트
 * 복사 → ChatGPT/Claude에 입력 → JSON 응답을 다시 붙여넣어 일괄 import.
 * MVP 단계에서는 운영자 수동 작업. 단어 수가 늘면 API 자동화로 전환.
 */
@Entity('ll_word_forms')
@Index(['baseWord', 'languageId'], { unique: true })
export class WordForm {
  @PrimaryGeneratedColumn()
  id: number;

  /** 사전형(원형). 예: "run" / "apple" / "beautiful". 소문자 정규화. */
  @Column('text', { name: 'baseWord' })
  baseWord: string;

  @ManyToOne(() => Language)
  @JoinColumn({ name: 'language_id' })
  language: Language;

  @Column({ name: 'language_id' })
  languageId: number;

  /** 'verb' | 'noun' | 'adjective' | 'adverb' | 'other'. */
  @Column('text', { name: 'partOfSpeech' })
  partOfSpeech: string;

  /** 한국어 뜻 (선택). 다의어는 첫 의미만. */
  @Column('text', { nullable: true })
  meaning: string | null;

  /**
   * 품사별 활용형 맵.
   * verb: { base, past, pastParticiple, presentParticiple, thirdPersonSingular }
   * noun: { singular, plural }
   * adjective: { base, comparative, superlative }
   * adverb: { base }
   */
  @Column('jsonb')
  forms: Record<string, string>;

  /**
   * 각 활용형에 대응하는 예문. 키는 forms와 동일. 일부 활용형에만 예문이
   * 있어도 됨. 한국 학습자용으로 자연스럽고 짧은 문장.
   */
  @Column('jsonb', { nullable: true })
  examples: Record<string, string> | null;

  /** 'manual-claude' / 'manual-gpt-4o' / 'curated' 등 — 출처/모델 메타. */
  @Column('text', { default: 'manual' })
  source: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
