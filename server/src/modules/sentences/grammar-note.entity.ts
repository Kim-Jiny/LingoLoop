import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Sentence } from './sentence.entity.js';

@Entity('ll_grammar_notes')
export class GrammarNote {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Sentence, (sentence) => sentence.grammarNotes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sentence_id' })
  sentence: Sentence;

  @Column({ name: 'sentence_id' })
  sentenceId: number;

  @Column()
  title: string;

  @Column('text')
  explanation: string;

  @Column('text', { nullable: true })
  example: string;

  @Column({ default: 0 })
  orderIndex: number;
}
