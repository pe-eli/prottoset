import { Router } from 'express';
import { whatsappController } from '../controllers/whatsapp.controller';
import { createSecurityRateLimit } from '../middleware/rate-limit.middleware';
import { enforceQuota } from '../middleware/quota.middleware';
import { requireVerifiedAccount } from '../middleware/verified-account.middleware';

const router = Router();

const blastLimiter = createSecurityRateLimit({
	name: 'whatsapp-blast',
	message: 'Limite de disparos temporariamente atingido. Tente novamente em alguns minutos.',
	ip: { limit: 5, windowMs: 10 * 60 * 1000 },
	user: { limit: 10, windowMs: 10 * 60 * 1000 },
});

// Static routes BEFORE dynamic
router.post(
	'/blast',
	blastLimiter,
	requireVerifiedAccount(),
	enforceQuota({ quotaKey: 'whatsapp_blasts_daily', message: 'Cota diária de blasts WhatsApp atingida.', cost: 1 }),
	whatsappController.sendBlast,
);
router.post('/blast/:blastId/cancel', whatsappController.cancelBlast);
router.get('/blast/:blastId/status', whatsappController.statusBlast);
router.get('/blast/:blastId/stream', whatsappController.streamBlast);

export default router;
