import crypto from 'crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { authConfig, CSRF_COOKIE } from '../auth/auth.config';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function ensureCsrfCookie(req: Request, res: Response, next: NextFunction): void {
  const existing = req.cookies?.[CSRF_COOKIE];
  if (!existing) {
    const token = crypto.randomBytes(32).toString('base64url');
    res.cookie(CSRF_COOKIE, token, authConfig.csrfCookieOptions());
  }
  next();
}

export function requireCsrfToken(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    const headerToken = req.header('x-csrf-token');
    const cookieToken = req.cookies?.[CSRF_COOKIE];

    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      res.status(403).json({ error: 'CSRF token inválido' });
      return;
    }

    next();
  };
}