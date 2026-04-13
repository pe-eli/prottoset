import type { Request, Response, NextFunction } from 'express';

export async function requireVerifiedEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.authUser) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  if (!req.authUser.emailVerified) {
    res.status(403).json({ error: 'Confirme seu e-mail para acessar esta funcionalidade.' });
    return;
  }

  next();
}
