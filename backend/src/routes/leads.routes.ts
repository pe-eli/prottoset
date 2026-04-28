import { Router } from 'express';
import { leadsController } from '../controllers/leads.controller';
import { createSecurityRateLimit } from '../middleware/rate-limit.middleware';
import { enforceQuotaForInactiveSubscription } from '../middleware/quota.middleware';
import { allowLeadsSearchForFreeTier } from '../middleware/free-tier.middleware';
import { enforceFeatureLimitForActiveSubscription } from '../middleware/subscription.middleware';

const router = Router();

const leadsSearchLimiter = createSecurityRateLimit({
	name: 'leads-search',
	message: 'Erro 429 (Too Many Requests): aguarde uns instantes antes de prospectar novamente.',
	ip: { limit: 10, windowMs: 60 * 1000 },
	user: { limit: 10, windowMs: 60 * 1000 },
});

const discoverySearchLimiter = createSecurityRateLimit({
	name: 'leads-discovery-search',
	message: 'Erro 429 (Too Many Requests): aguarde uns instantes antes de iniciar nova descoberta.',
	ip: { limit: 4, windowMs: 60 * 1000 },
	user: { limit: 4, windowMs: 60 * 1000 },
});

router.get('/', leadsController.getAll);
router.post(
	'/discovery/search',
	discoverySearchLimiter,
	enforceFeatureLimitForActiveSubscription('leads'),
	enforceQuotaForInactiveSubscription({
		quotaKey: 'discovery_searches_daily',
		message: 'Cota diária de Discovery atingida.',
		cost: () => 1,
	}),
	allowLeadsSearchForFreeTier(),
	leadsController.createDiscoverySearch,
);
router.get('/discovery/searches/:searchId', leadsController.getDiscoverySearchStatus);
router.get('/discovery/searches/:searchId/results', leadsController.getDiscoverySearchResults);
router.post(
	'/search',
	leadsSearchLimiter,
	enforceFeatureLimitForActiveSubscription('leads'),
	enforceQuotaForInactiveSubscription({
		quotaKey: 'scrape_requests_daily',
		message: 'Cota diária de scraping atingida.',
		cost: (req) => {
			const raw = Number(req.body?.maxResults);
			return Number.isFinite(raw) ? Math.max(1, Math.min(100, Math.floor(raw))) : 50;
		},
	}),
	allowLeadsSearchForFreeTier(),
	leadsController.search,
);
router.get('/search-quota', leadsController.getSearchQuota);
router.get('/:id', leadsController.getById);
router.patch('/:id/status', leadsController.updateStatus);
router.delete('/:id', leadsController.delete);

export default router;
