import { Router } from 'express';
import { packagesController } from '../controllers/packages.controller';
import { requireActiveSubscription } from '../middleware/subscription.middleware';
import { enforceQuota } from '../middleware/quota.middleware';
import { createSecurityRateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

const packagePdfLimiter = createSecurityRateLimit({
	name: 'packages-generate-pdf',
	message: 'Muitas solicitações de PDF. Aguarde alguns minutos.',
	ip: { limit: 20, windowMs: 10 * 60 * 1000 },
	user: { limit: 30, windowMs: 10 * 60 * 1000 },
});

router.post(
	'/generate-pdf',
	packagePdfLimiter,
	requireActiveSubscription('quotes'),
	enforceQuota({ quotaKey: 'pdf_generations_daily', message: 'Cota diária de geração de PDF atingida.', cost: 1 }),
	packagesController.generatePdf,
);
router.get('/:id/pdf', packagesController.downloadPdf);

export default router;
