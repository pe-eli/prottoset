import { Router } from 'express';
import { quoteController } from '../controllers/quote.controller';
import { requireActiveSubscription } from '../middleware/subscription.middleware';
import { enforceQuota } from '../middleware/quota.middleware';
import { createSecurityRateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

const quotePdfLimiter = createSecurityRateLimit({
	name: 'quotes-generate-pdf',
	message: 'Muitas gerações de orçamento em pouco tempo. Aguarde alguns minutos.',
	ip: { limit: 20, windowMs: 10 * 60 * 1000 },
	user: { limit: 30, windowMs: 10 * 60 * 1000 },
});

router.post(
	'/generate-pdf',
	quotePdfLimiter,
	requireActiveSubscription('quotes'),
	enforceQuota({ quotaKey: 'pdf_generations_daily', message: 'Cota diária de geração de PDF atingida.', cost: 1 }),
	quoteController.generatePdf,
);
router.get('/:id/pdf', quoteController.downloadPdf);
router.get('/', quoteController.list);
router.get('/:id', quoteController.getById);

export default router;
