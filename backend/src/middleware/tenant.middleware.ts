import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

export function setTenant(req: Request, _res: Response, next: NextFunction): void {
  if (req.authUser) {
    req.tenantId = req.authUser.userId;
  }
  next();
}
