import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { CookieOptions } from 'express';

const SESSION_COOKIE_NAME = 'prottoset_session';

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function getJwtSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error('AUTH_JWT_SECRET não configurado');
  }
  return secret;
}

function getSessionHours(): number {
  const parsed = Number(process.env.AUTH_SESSION_HOURS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 12;
  return Math.floor(parsed);
}

function getConfiguredUsername(): string {
  const user = process.env.AUTH_USERNAME;
  if (!user) {
    throw new Error('AUTH_USERNAME não configurado');
  }
  return user;
}

function getConfiguredPasswordHash(): string {
  const hash = process.env.AUTH_PASSWORD_HASH;
  if (!hash) {
    throw new Error('AUTH_PASSWORD_HASH não configurado');
  }
  return hash;
}

export interface SessionPayload {
  username: string;
}

export const authService = {
  sessionCookieName: SESSION_COOKIE_NAME,

  getCookieOptions(): CookieOptions {
    const hours = getSessionHours();
    return {
      httpOnly: true,
      secure: isProduction(),
      sameSite: 'lax',
      path: '/',
      maxAge: hours * 60 * 60 * 1000,
    };
  },

  async validateCredentials(username: string, password: string): Promise<boolean> {
    const expectedUsername = getConfiguredUsername();
    const expectedPasswordHash = getConfiguredPasswordHash();

    if (username !== expectedUsername) return false;
    return bcrypt.compare(password, expectedPasswordHash);
  },

  signSession(payload: SessionPayload): string {
    const secret = getJwtSecret();
    const hours = getSessionHours();
    return jwt.sign({ sub: payload.username }, secret, {
      expiresIn: `${hours}h`,
      issuer: 'prottoset-backend',
      audience: 'prottoset-app',
    });
  },

  verifySession(token: string): SessionPayload | null {
    try {
      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret, {
        issuer: 'prottoset-backend',
        audience: 'prottoset-app',
      }) as jwt.JwtPayload;

      const username = typeof decoded.sub === 'string' ? decoded.sub : '';
      if (!username) return null;
      return { username };
    } catch {
      return null;
    }
  },
};
