import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../auth/tokens';
import { ACCESS_COOKIE } from '../auth/auth.config';
import '../auth/auth.types';

function readToken(req: Request): string | null {
  const fromCookie = req.cookies?.[ACCESS_COOKIE];
  if (typeof fromCookie === 'string' && fromCookie) return fromCookie;

  const authHeader = req.header('authorization');
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sessão inválida ou expirada' });
    return;
  }

  if (payload.tenantId !== payload.sub) {
    res.status(401).json({ error: 'Sessão inválida ou expirada' });
    return;
  }

  req.authUser = {
    userId: payload.sub,
    email: payload.email,
    role: payload.role,
    tenantId: payload.tenantId,
    emailVerified: payload.emailVerified,
  };
  next();
}
