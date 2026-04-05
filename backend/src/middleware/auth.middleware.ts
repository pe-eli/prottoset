import { Request, Response, NextFunction } from 'express';
import { authService } from '../auth/auth.service';

function readToken(req: Request): string | null {
  const fromCookie = req.cookies?.[authService.sessionCookieName];
  if (typeof fromCookie === 'string' && fromCookie) return fromCookie;

  const authHeader = req.header('authorization');
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  const session = authService.verifySession(token);
  if (!session) {
    res.status(401).json({ error: 'Sessão inválida ou expirada' });
    return;
  }

  (req as Request & { authUser?: string }).authUser = session.username;
  next();
}
