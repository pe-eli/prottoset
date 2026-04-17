import { Router } from 'express';
import { whatsappController } from '../controllers/whatsapp.controller';
import { waInstanceController } from '../controllers/whatsapp-instance.controller';
import { createSecurityRateLimit } from '../middleware/rate-limit.middleware';
import { enforceQuota } from '../middleware/quota.middleware';
import { requireActiveSubscription } from '../middleware/subscription.middleware';
import { requireConnectedWhatsApp } from '../middleware/whatsapp-connected.middleware';

const router = Router();

const blastLimiter = createSecurityRateLimit({
	name: 'whatsapp-blast',
	message: 'Limite de disparos temporariamente atingido. Tente novamente em alguns minutos.',
	ip: { limit: 5, windowMs: 10 * 60 * 1000 },
	user: { limit: 10, windowMs: 10 * 60 * 1000 },
});

// ─── Instance management ───
router.get('/instance', waInstanceController.getStatus);
router.post('/connect', waInstanceController.connect);
router.post('/disconnect', waInstanceController.disconnect);

// ─── Blast routes ───
router.post(
	'/blast',
	blastLimiter,
	requireActiveSubscription('whatsapp'),
	enforceQuota({ quotaKey: 'whatsapp_blasts_daily', message: 'Cota diária de blasts WhatsApp atingida.', cost: 1 }),
	requireConnectedWhatsApp(),
	whatsappController.sendBlast,
);
router.post('/blast/:blastId/cancel', whatsappController.cancelBlast);
router.get('/blast/:blastId/status', whatsappController.statusBlast);
router.get('/blast/:blastId/stream', whatsappController.streamBlast);

export default router;
