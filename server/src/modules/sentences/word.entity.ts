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

  /**
   * 이 단어 카드의 원형. e.g. 문장이 "She ran fast"이고 word="ran"이면
   * baseWord="run". 북마크 시 vocab에 그대로 전파, 활용형 사전 join 키.
   */
  @Column({ name: 'baseWord', nullable: true })
  baseWord: string;

  /**
   * 어떤 활용형인지 — ll_word_forms.forms의 키와 동일.
   * 위 ran 예시는 form='past'.
   */
  @Column({ nullable: true })
  form: string;

  @Column({ nullable: true })
  example: string;

  @Column({ default: 0 })
  orderIndex: number;
}
