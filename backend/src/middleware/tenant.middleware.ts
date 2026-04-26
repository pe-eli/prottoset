import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

export function setTenant(req: Request, res: Response, next: NextFunction): void {
  if (req.authUser) {
    if (req.authUser.tenantId !== req.authUser.userId) {
      res.status(401).json({ error: 'Sessão inválida ou expirada' });
      return;
    }
    req.tenantId = req.authUser.tenantId;
  }
  next();
}
