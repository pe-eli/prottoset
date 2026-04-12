import type { Request, Response, NextFunction, RequestHandler } from 'express';
import crypto from 'crypto';
import { authConfig } from '../auth/auth.config';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const TOKEN_PARTS = 3;

function signCsrfPayload(payload: string): string {
  return crypto.createHmac('sha256', authConfig.jwtSecret()).update(payload).digest('base64url');
}

export function issueCsrfToken(): string {
  const expiresAt = Date.now() + CSRF_TOKEN_TTL_MS;
  const nonce = crypto.randomBytes(24).toString('base64url');
  const payload = `${expiresAt}.${nonce}`;
  const signature = signCsrfPayload(payload);
  return `${payload}.${signature}`;
}

function isValidCsrfToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== TOKEN_PARTS) {
    return false;
  }

  const [expiresAtRaw, nonce, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false;
  }

  const payload = `${expiresAt}.${nonce}`;
  const expected = signCsrfPayload(payload);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function sendCsrfToken(_req: Request, res: Response, _next?: NextFunction): void {
  res.json({ csrfToken: issueCsrfToken() });
}

export function requireCsrfToken(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    const headerToken = req.header('x-csrf-token');

    if (!headerToken || !isValidCsrfToken(headerToken)) {
      res.status(403).json({ error: 'CSRF token inválido' });
      return;
    }

    next();
  };
}