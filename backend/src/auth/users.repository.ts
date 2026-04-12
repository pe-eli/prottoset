import { query } from '../db/pool';
import type { UserDoc } from './auth.types';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  google_id: string | null;
  email_verified: boolean;
  role: 'owner' | 'member';
  created_at: Date;
  updated_at: Date;
}

function toUser(row: UserRow): UserDoc {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    googleId: row.google_id || '',
    emailVerified: row.email_verified,
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

  async create(data: Omit<UserDoc, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserDoc> {
    const { rows } = await query<UserRow>(
      `INSERT INTO users (email, display_name, password_hash, google_id, email_verified, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.email.toLowerCase(),
        data.displayName,
        data.passwordHash,
        data.googleId || null,
        data.emailVerified,
        data.role,
      ],
    );
    return toUser(rows[0]);
  },

  async updateGoogleLink(id: string, googleId: string): Promise<void> {
    await query(
      'UPDATE users SET google_id = $1, email_verified = true, updated_at = now() WHERE id = $2',
      [googleId, id],
    );
  },
};
