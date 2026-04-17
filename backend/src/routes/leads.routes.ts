import { Router } from 'express';
import { leadsController } from '../controllers/leads.controller';
import { createSecurityRateLimit } from '../middleware/rate-limit.middleware';
import { enforceQuota } from '../middleware/quota.middleware';
import { allowLeadsSearchForFreeTier } from '../middleware/free-tier.middleware';
import { enforceFeatureLimitForActiveSubscription } from '../middleware/subscription.middleware';

const router = Router();

const leadsSearchLimiter = createSecurityRateLimit({
	name: 'leads-search',
	message: 'Muitas buscas em pouco tempo. Aguarde alguns minutos.',
	ip: { limit: 10, windowMs: 10 * 60 * 1000 },
	user: { limit: 20, windowMs: 10 * 60 * 1000 },
});

router.get('/', leadsController.getAll);
router.post(
	'/search',
	leadsSearchLimiter,
	allowLeadsSearchForFreeTier(),
	enforceFeatureLimitForActiveSubscription('leads'),
	enforceQuota({
		quotaKey: 'scrape_requests_daily',
		message: 'Cota diária de scraping atingida.',
		cost: (req) => {
			const raw = Number(req.body?.maxResults);
			return Number.isFinite(raw) ? Math.max(1, Math.min(100, Math.floor(raw))) : 50;
		},
	}),
	leadsController.search,
);
router.get('/search-quota', leadsController.getSearchQuota);
router.get('/:id', leadsController.getById);
router.patch('/:id/status', leadsController.updateStatus);
router.delete('/:id', leadsController.delete);

export default router;
