import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Sentence } from '../sentences/sentence.entity.js';

export enum QuizType {
  FILL_BLANK = 'fill_blank',
  WORD_ORDER = 'word_order',
  TRANSLATION = 'translation',
  MULTIPLE_CHOICE = 'multiple_choice',
}

@Entity('ll_quizzes')
export class Quiz {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Sentence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sentence_id' })
  sentence: Sentence;

  @Column({ name: 'sentence_id' })
  sentenceId: number;

  @Column({ type: 'enum', enum: QuizType })
  type: QuizType;

  @Column({ type: 'jsonb' })
  question: Record<string, any>;

  @Column({ type: 'jsonb' })
  answer: Record<string, any>;

  /**
   * 'auto'  — 문장 단어에서 자동 생성된 기본 퀴즈(무료 포함 모든 유저).
   * 'admin' — backstage에서 운영자가 손으로 추가한 문제 풀(구독자 전용).
   * 프리미엄 유저는 (auto + admin) 풀에서 랜덤하게 더 다양하게 받는다.
   */
  @Column({ type: 'varchar', default: 'auto' })
  origin: string;

  @CreateDateColumn()
  createdAt: Date;
}
