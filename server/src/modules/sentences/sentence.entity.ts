import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Language } from './language.entity.js';
import { Word } from './word.entity.js';
import { GrammarNote } from './grammar-note.entity.js';

export enum Difficulty {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

@Entity('ll_sentences')
export class Sentence {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Language, (language) => language.sentences)
  @JoinColumn({ name: 'language_id' })
  language: Language;

  @Column({ name: 'language_id' })
  languageId: number;

  @Column('text')
  text: string;

  @Column('text')
  translation: string;

  @Column('text', { nullable: true })
  pronunciation: string;

  @Column('text', { nullable: true })
  situation: string;

  @Column({ type: 'enum', enum: Difficulty, default: Difficulty.BEGINNER })
  difficulty: Difficulty;

  @Column({ nullable: true })
  category: string;

  @Column({ default: 0 })
  orderIndex: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Word, (word) => word.sentence, { cascade: true })
  words: Word[];

  @OneToMany(() => GrammarNote, (note) => note.sentence, { cascade: true })
  grammarNotes: GrammarNote[];
}
