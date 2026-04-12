import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { quotaRepository } from '../security/quota.repository';
import type { QuotaKey } from '../security/quotas';

interface QuotaOptions {
  quotaKey: QuotaKey;
  message: string;
  cost: number | ((req: Request) => number);
}

export function enforceQuota(options: QuotaOptions): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(401).json({ error: 'Não autenticado' });
        return;
      }

      const computedCost = typeof options.cost === 'function' ? options.cost(req) : options.cost;
      const cost = Math.max(1, Math.floor(computedCost || 1));
      const result = await quotaRepository.ensureWithinLimit(tenantId, options.quotaKey, cost);
      if (!result.allowed) {
        res.status(429).json({
          error: options.message,
          quota: {
            key: options.quotaKey,
            limit: result.limit,
            remaining: result.remaining,
          },
        });
        return;
      }

      await quotaRepository.consume(tenantId, options.quotaKey, cost);
      next();
    } catch (err) {
      next(err);
    }
  };
}