import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Sentence } from './sentence.entity.js';

@Entity('ll_languages')
export class Language {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 10 })
  code: string;

  @Column()
  name: string;

  @Column()
  nativeName: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Sentence, (sentence) => sentence.language)
  sentences: Sentence[];
}
