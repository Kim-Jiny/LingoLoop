import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Sentence } from './sentence.entity.js';

@Entity('ll_words')
export class Word {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Sentence, (sentence) => sentence.words, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sentence_id' })
  sentence: Sentence;

  @Column({ name: 'sentence_id' })
  sentenceId: number;

  @Column()
  word: string;

  @Column()
  meaning: string;

  @Column({ nullable: true })
  pronunciation: string;

  @Column({ nullable: true })
  partOfSpeech: string;

  @Column({ nullable: true })
  example: string;

  @Column({ default: 0 })
  orderIndex: number;
}
