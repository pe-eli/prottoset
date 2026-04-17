import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { quotaRepository } from '../security/quota.repository';
import { subscriptionRepository } from '../modules/subscriptions/subscription.repository';
import { getSubscriptionOverride } from '../config/subscription-overrides';

function normalizeCost(rawCost: unknown): number {
  const parsed = Number(rawCost);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

export function allowLeadsSearchForFreeTier(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.authUser?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Não autenticado' });
        return;
      }

      const override = getSubscriptionOverride(userId);
      const sub = await subscriptionRepository.findActiveByUserId(userId);
      const isActive = override?.forceStatus === 'active' || (!!sub && sub.status === 'active');
      if (isActive) {
        next();
        return;
      }

      const cost = normalizeCost(req.body?.maxResults);
      const result = await quotaRepository.tryConsumeAtomic(userId, 'free_leads_daily', cost);
      if (!result.allowed) {
        res.status(429).json({
          error: 'Limite diário do plano gratuito atingido (50 leads por dia).',
          code: 'free_tier_limit_exceeded',
          quota: {
            key: 'free_leads_daily',
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
