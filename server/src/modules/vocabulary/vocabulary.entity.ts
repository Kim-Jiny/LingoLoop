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

@Entity('ll_vocabulary')
@Index(['userId', 'word'], { unique: true })
export class Vocabulary {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column('text')
  word: string;

  @Column('text', { nullable: true })
  meaning: string | null;

  @Column('text', { nullable: true })
  context: string | null;

  @ManyToOne(() => Sentence, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sentence_id' })
  sentence: Sentence;

  @Column({ name: 'sentence_id', type: 'int', nullable: true })
  sentenceId: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
