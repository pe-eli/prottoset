import type { Request, Response, NextFunction } from 'express';
import { fraudService } from '../security/fraud.service';

export async function requireTenantNotBlocked(req: Request, res: Response, next: NextFunction): Promise<void> {
  const tenantId = req.tenantId ?? req.authUser?.userId;
  if (!tenantId) {
    next();
    return;
  }

  const block = await fraudService.isTenantBlocked(tenantId);
  if (!block.blocked) {
    next();
    return;
  }

  res.status(423).json({
    error: 'Conta temporariamente bloqueada por segurança.',
    code: 'tenant_temporarily_blocked',
    reason: block.reason,
    blockedUntil: block.blockedUntil,
  });
}
