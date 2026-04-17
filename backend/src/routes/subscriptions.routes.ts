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

const reconcileLimiter = createSecurityRateLimit({
  name: 'subscription-reconcile',
  message: 'Muitas tentativas de reconciliação. Aguarde alguns minutos.',
  ip: { limit: 5, windowMs: 10 * 60 * 1000 },
  user: { limit: 10, windowMs: 10 * 60 * 1000 },
});

router.get('/plans', subscriptionsController.getPlans);
router.post('/checkout', checkoutLimiter, subscriptionsController.checkout);
router.get('/me', subscriptionsController.getMe);
router.post('/cancel', cancelLimiter, subscriptionsController.cancel);
router.post('/admin/reconcile', reconcileLimiter, subscriptionsController.reconcile);

export default router;
