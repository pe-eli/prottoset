import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { quotaRepository } from '../security/quota.repository';
import type { QuotaKey } from '../security/quotas';
import { subscriptionService } from '../modules/subscriptions/subscription.service';

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
      const result = await quotaRepository.tryConsumeAtomic(tenantId, options.quotaKey, cost);
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
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function enforceQuotaForInactiveSubscription(options: QuotaOptions): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.authUser?.userId;
      const tenantId = req.tenantId;
      if (!userId || !tenantId) {
        res.status(401).json({ error: 'Não autenticado' });
        return;
      }

      const state = await subscriptionService.resolveAccessState(userId);
      if (state.isActive) {
        next();
        return;
      }

      const computedCost = typeof options.cost === 'function' ? options.cost(req) : options.cost;
      const cost = Math.max(1, Math.floor(computedCost || 1));
      const result = await quotaRepository.tryConsumeAtomic(tenantId, options.quotaKey, cost);
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
      next();
    } catch (err) {
      next(err);
    }
  };
}