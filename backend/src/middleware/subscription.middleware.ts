import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { subscriptionRepository } from '../modules/subscriptions/subscription.repository';
import { usageRepository } from '../modules/subscriptions/usage.repository';
import { PLANS, FEATURE_LIMIT_MAP, isValidPlanId, type SubscriptionFeature } from '../config/plans';

export function requireActiveSubscription(feature?: SubscriptionFeature): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.authUser?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Não autenticado' });
        return;
      }

      const sub = await subscriptionRepository.findActiveByUserId(userId);
      if (!sub || sub.status !== 'active') {
        res.status(402).json({
          error: 'Assinatura ativa necessária para esta funcionalidade.',
          code: 'subscription_required',
          redirect: '/pricing',
        });
        return;
      }

      // If no specific feature to check, just verify active subscription
      if (!feature) {
        next();
        return;
      }

      const planId = isValidPlanId(sub.planId) ? sub.planId : null;
      if (!planId) {
        res.status(402).json({
          error: 'Plano inválido. Entre em contato com o suporte.',
          code: 'subscription_required',
          redirect: '/pricing',
        });
        return;
      }

      const plan = PLANS[planId];
      const limitKey = FEATURE_LIMIT_MAP[feature];
      const limit = plan.limits[limitKey] as number | null;

      // null = unlimited
      if (limit === null) {
        next();
        return;
      }

      const usage = await usageRepository.getUsageForMonth(userId);
      const usageMap: Record<SubscriptionFeature, number> = {
        leads: usage.leadsUsed,
        whatsapp: usage.whatsappUsed,
        emails: usage.emailsUsed,
        quotes: usage.quotesUsed,
      };

      const used = usageMap[feature];
      if (used >= limit) {
        res.status(429).json({
          error: 'Limite mensal atingido para esta funcionalidade.',
          code: 'limit_exceeded',
          feature,
          used,
          limit,
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
