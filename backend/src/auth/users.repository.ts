import { query } from '../db/pool';
import type { UserDoc } from './auth.types';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  google_id: string | null;
  email_verified: boolean;
  verification_token_hash: string | null;
  verification_expires_at: Date | null;
  role: 'owner' | 'member';
  created_at: Date;
  updated_at: Date;
}

interface CreateUserInput {
  email: string;
  displayName: string;
  passwordHash: string;
  googleId: string;
  emailVerified: boolean;
  verificationTokenHash?: string | null;
  verificationExpiresAt?: string | null;
  role: 'owner' | 'member';
}

function toUser(row: UserRow): UserDoc {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    googleId: row.google_id || '',
    emailVerified: row.email_verified,
    verificationTokenHash: row.verification_token_hash,
    verificationExpiresAt: row.verification_expires_at ? row.verification_expires_at.toISOString() : null,
    role: row.role,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export const usersRepository = {
  async getById(id: string): Promise<UserDoc | null> {
    const { rows } = await query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ? toUser(rows[0]) : null;
  },

  async getByEmail(email: string): Promise<UserDoc | null> {
    const { rows } = await query<UserRow>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    return rows[0] ? toUser(rows[0]) : null;
  },

  async getByGoogleId(googleId: string): Promise<UserDoc | null> {
    const { rows } = await query<UserRow>('SELECT * FROM users WHERE google_id = $1', [googleId]);
    return rows[0] ? toUser(rows[0]) : null;
  },

  async create(data: CreateUserInput): Promise<UserDoc> {
    const { rows } = await query<UserRow>(
      `INSERT INTO users (email, display_name, password_hash, google_id, email_verified, verification_token_hash, verification_expires_at, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.email.toLowerCase(),
        data.displayName,
        data.passwordHash,
        data.googleId || null,
        data.emailVerified,
        data.verificationTokenHash ?? null,
        data.verificationExpiresAt ?? null,
        data.role,
      ],
    );
    return toUser(rows[0]);
  },

  async setVerificationToken(userId: string, tokenHash: string, expiresAtIso: string): Promise<void> {
    await query(
      `UPDATE users
       SET verification_token_hash = $1,
           verification_expires_at = $2,
           updated_at = now()
       WHERE id = $3`,
      [tokenHash, expiresAtIso, userId],
    );
  },

  async markEmailVerified(userId: string): Promise<void> {
    await query(
      `UPDATE users
       SET email_verified = true,
           verification_token_hash = NULL,
           verification_expires_at = NULL,
           updated_at = now()
       WHERE id = $1`,
      [userId],
    );
  },

  async updateGoogleLink(id: string, googleId: string): Promise<void> {
    await query(
      'UPDATE users SET google_id = $1, email_verified = true, updated_at = now() WHERE id = $2',
      [googleId, id],
    );
  },
};
