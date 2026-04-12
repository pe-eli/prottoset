import { v4 as uuid } from 'uuid';
import { hashPassword, verifyPassword } from './password';
import { signAccessToken, generateRefreshToken, hashToken } from './tokens';
import { refreshTokensRepository } from './refresh-tokens.repository';
import { usersRepository } from './users.repository';
import { authConfig, ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE } from './auth.config';
import type { Response } from 'express';
import type { UserDoc } from './auth.types';
import crypto from 'crypto';

function issueCsrfCookie(res: Response): string {
  const csrfToken = crypto.randomBytes(32).toString('base64url');
  res.cookie(CSRF_COOKIE, csrfToken, authConfig.csrfCookieOptions());
  return csrfToken;
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
    issueCsrfCookie(res);

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
    issueCsrfCookie(res);

    return accessToken;
  },

  clearSession(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, { ...authConfig.accessCookieOptions(), maxAge: 0 });
    res.clearCookie(REFRESH_COOKIE, { ...authConfig.refreshCookieOptions(), maxAge: 0 });
    res.clearCookie(CSRF_COOKIE, { ...authConfig.csrfCookieOptions(), maxAge: 0 });
  },
};
