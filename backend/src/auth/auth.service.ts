import { v4 as uuid } from 'uuid';
import { hashPassword, verifyPassword } from './password';
import { signAccessToken, generateRefreshToken } from './tokens';
import { refreshTokensRepository } from './refresh-tokens.repository';
import { usersRepository } from './users.repository';
import { authConfig, ACCESS_COOKIE, REFRESH_COOKIE } from './auth.config';
import type { Response } from 'express';
import type { UserDoc } from './auth.types';
import { withTransaction } from '../db/pool';

interface RefreshTokenLockRow {
  id: string;
  user_id: string;
  family: string;
  expires_at: Date;
  revoked: boolean;
}

interface UserLockRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  email_verified: boolean;
}

export const authService = {
  hashPassword,
  verifyPassword,

  async issueSession(res: Response, user: UserDoc): Promise<string> {
    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.id,
      emailVerified: user.emailVerified,
    });

    const { raw, hash } = generateRefreshToken();
    const days = authConfig.refreshTokenDays();
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    await refreshTokensRepository.create({
      tokenHash: hash,
      userId: user.id,
      family: uuid(),
      expiresAt,
      revoked: false,
      createdAt: new Date().toISOString(),
    });

    res.cookie(ACCESS_COOKIE, accessToken, authConfig.accessCookieOptions());
    res.cookie(REFRESH_COOKIE, raw, authConfig.refreshCookieOptions());

    return accessToken;
  },

  async rotateRefresh(res: Response, oldToken: { id: string; userId: string; family: string }): Promise<string | null> {
    const user = await usersRepository.getById(oldToken.userId);
    if (!user) return null;

    await refreshTokensRepository.revokeById(oldToken.id);

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.id,
      emailVerified: user.emailVerified,
    });

    const { raw, hash } = generateRefreshToken();
    const days = authConfig.refreshTokenDays();
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    await refreshTokensRepository.create({
      tokenHash: hash,
      userId: user.id,
      family: oldToken.family,
      expiresAt,
      revoked: false,
      createdAt: new Date().toISOString(),
    });

    res.cookie(ACCESS_COOKIE, accessToken, authConfig.accessCookieOptions());
    res.cookie(REFRESH_COOKIE, raw, authConfig.refreshCookieOptions());

    return accessToken;
  },

  async rotateRefreshWithLock(res: Response, refreshTokenHash: string): Promise<{
    accessToken: string;
    user: { id: string; email: string; displayName: string; role: string; emailVerified: boolean };
  } | null> {
    const result = await withTransaction(async (client) => {
      const tokenResult = await client.query<RefreshTokenLockRow>(
        `SELECT id, user_id, family, expires_at, revoked
         FROM refresh_tokens
         WHERE token_hash = $1
         FOR UPDATE`,
        [refreshTokenHash],
      );

      const token = tokenResult.rows[0];
      if (!token) {
        return null;
      }

      if (token.revoked || token.expires_at.getTime() < Date.now()) {
        await client.query(
          `UPDATE refresh_tokens
           SET revoked = true
           WHERE family = $1 AND NOT revoked`,
          [token.family],
        );
        return null;
      }

      const userResult = await client.query<UserLockRow>(
        `SELECT id, email, display_name, role, email_verified
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [token.user_id],
      );
      const user = userResult.rows[0];
      if (!user) {
        await client.query('UPDATE refresh_tokens SET revoked = true WHERE family = $1 AND NOT revoked', [token.family]);
        return null;
      }

      await client.query('UPDATE refresh_tokens SET revoked = true WHERE family = $1 AND NOT revoked', [token.family]);

      const { raw, hash } = generateRefreshToken();
      const days = authConfig.refreshTokenDays();
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      await client.query(
        `INSERT INTO refresh_tokens (token_hash, user_id, family, expires_at, revoked, created_at)
         VALUES ($1, $2, $3, $4, false, now())`,
        [hash, user.id, token.family, expiresAt],
      );

      const accessToken = await signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.id,
        emailVerified: user.email_verified,
      });

      return {
        accessToken,
        refreshTokenRaw: raw,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          role: user.role,
          emailVerified: user.email_verified,
        },
      };
    });

    if (!result) {
      return null;
    }

    res.cookie(ACCESS_COOKIE, result.accessToken, authConfig.accessCookieOptions());
    res.cookie(REFRESH_COOKIE, result.refreshTokenRaw, authConfig.refreshCookieOptions());

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  },

  clearSession(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, { ...authConfig.accessCookieOptions(), maxAge: 0 });
    res.clearCookie(REFRESH_COOKIE, { ...authConfig.refreshCookieOptions(), maxAge: 0 });
  },
};
