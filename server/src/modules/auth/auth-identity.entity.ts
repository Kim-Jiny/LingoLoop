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

export type SocialProvider = 'google' | 'apple' | 'kakao';

/**
 * A social identity linked to a user account. One user can have many
 * identities (email/password + Google + Apple + Kakao). A given social
 * identity (provider + providerId) is globally unique — it can belong to
 * exactly one account, so it can never be linked to another login.
 */
@Entity('ll_auth_identities')
@Index(['provider', 'providerId'], { unique: true })
export class AuthIdentity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  provider: string;

  @Column({ name: 'provider_id' })
  providerId: string;

  @Column({ type: 'text', nullable: true })
  email: string | null;

  /**
   * Apple refresh_token obtained during sign-in via the
   * authorization_code → /auth/token exchange. Stored only for Apple
   * identities. Used at account-deletion time to revoke the user's
   * Apple session per App Store guideline 5.1.1(v).
   */
  @Column({ name: 'apple_refresh_token', type: 'text', nullable: true })
  appleRefreshToken: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
