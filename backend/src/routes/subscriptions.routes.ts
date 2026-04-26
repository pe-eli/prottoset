import { Router } from 'express';
import { subscriptionsController } from '../controllers/subscriptions.controller';
import { createSecurityRateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

const checkoutLimiter = createSecurityRateLimit({
  name: 'subscription-checkout',
  message: 'Muitas tentativas de checkout. Aguarde alguns minutos.',
  ip: { limit: 5, windowMs: 10 * 60 * 1000 },
  user: { limit: 10, windowMs: 10 * 60 * 1000 },
});

const cancelLimiter = createSecurityRateLimit({
  name: 'subscription-cancel',
  message: 'Muitas tentativas de cancelamento. Aguarde alguns minutos.',
  ip: { limit: 8, windowMs: 10 * 60 * 1000 },
  user: { limit: 8, windowMs: 10 * 60 * 1000 },
});

const changePlanLimiter = createSecurityRateLimit({
  name: 'subscription-change-plan',
  message: 'Muitas tentativas de troca de plano. Aguarde alguns minutos.',
  ip: { limit: 10, windowMs: 10 * 60 * 1000 },
  user: { limit: 10, windowMs: 10 * 60 * 1000 },
});

router.get('/plans', subscriptionsController.getPlans);
router.get('/me', subscriptionsController.getMe);
router.get('/billing-history', subscriptionsController.getBillingHistory);
router.post('/checkout', checkoutLimiter, subscriptionsController.checkout);
router.post('/billing-portal', subscriptionsController.billingPortal);
router.post('/change-plan', changePlanLimiter, subscriptionsController.changePlan);
router.post('/cancel', cancelLimiter, subscriptionsController.cancel);
router.post('/reactivate', subscriptionsController.reactivate);

export default router;
