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

  @CreateDateColumn()
  createdAt: Date;
}
