import { query } from '../db/pool';
import type { RefreshTokenDoc } from './auth.types';

interface RefreshTokenRow {
  id: string;
  token_hash: string;
  user_id: string;
  family: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}

function toRefreshToken(row: RefreshTokenRow): RefreshTokenDoc {
  return {
    id: row.id,
    tokenHash: row.token_hash,
    userId: row.user_id,
    family: row.family,
    expiresAt: row.expires_at.toISOString(),
    revoked: row.revoked,
    createdAt: row.created_at.toISOString(),
  };
}

export const refreshTokensRepository = {
  async create(data: Omit<RefreshTokenDoc, 'id'>): Promise<RefreshTokenDoc> {
    const { rows } = await query<RefreshTokenRow>(
      `INSERT INTO refresh_tokens (token_hash, user_id, family, expires_at, revoked, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.tokenHash, data.userId, data.family, data.expiresAt, data.revoked, data.createdAt],
    );
    return toRefreshToken(rows[0]);
  },

  async findByHash(hash: string): Promise<RefreshTokenDoc | null> {
    const { rows } = await query<RefreshTokenRow>(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND NOT revoked LIMIT 1',
      [hash],
    );
    return rows[0] ? toRefreshToken(rows[0]) : null;
  },

  async findByHashIncludingRevoked(hash: string): Promise<RefreshTokenDoc | null> {
    const { rows } = await query<RefreshTokenRow>(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 LIMIT 1',
      [hash],
    );
    return rows[0] ? toRefreshToken(rows[0]) : null;
  },

  async revokeById(id: string): Promise<void> {
    await query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [id]);
  },

  async revokeFamily(family: string): Promise<void> {
    await query('UPDATE refresh_tokens SET revoked = true WHERE family = $1 AND NOT revoked', [family]);
  },

  async revokeAllForUser(userId: string): Promise<void> {
    await query('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND NOT revoked', [userId]);
  },

  async deleteExpired(): Promise<void> {
    await query('DELETE FROM refresh_tokens WHERE expires_at < now()');
  },
};
