import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { authConfig } from '../auth/auth.config';

export function requireVerifiedAccount(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!authConfig.requireVerifiedAccountsForExpensiveActions()) {
      next();
      return;
    }

    const authUser = req.authUser;
    if (!authUser) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    if (authUser.role === 'owner' || authUser.emailVerified) {
      next();
      return;
    }

    res.status(403).json({ error: 'Conta não verificada para executar esta ação.' });
  };
}