import { Router } from 'express';
import { contactsController } from '../controllers/contacts.controller';
import { createSecurityRateLimit } from '../middleware/rate-limit.middleware';
import { enforceQuota } from '../middleware/quota.middleware';
import { requireVerifiedAccount } from '../middleware/verified-account.middleware';
import { requireActiveSubscription } from '../middleware/subscription.middleware';

const router = Router();

const blastLimiter = createSecurityRateLimit({
	name: 'contacts-blast',
	message: 'Limite de disparos temporariamente atingido. Tente novamente em alguns minutos.',
	ip: { limit: 5, windowMs: 10 * 60 * 1000 },
	user: { limit: 10, windowMs: 10 * 60 * 1000 },
});

router.get('/', contactsController.getAll);
router.post('/', contactsController.create);
router.post(
	'/blast',
	blastLimiter,
	requireVerifiedAccount(),
	requireActiveSubscription('emails'),
	enforceQuota({ quotaKey: 'email_blasts_daily', message: 'Cota diária de blasts por e-mail atingida.', cost: 1 }),
	enforceQuota({ quotaKey: 'email_messages_daily', message: 'Cota diária de envios por e-mail atingida.', cost: (req) => Array.isArray(req.body?.emails) ? req.body.emails.length : 1 }),
	contactsController.sendBlast,
);
router.get('/blast/:blastId/stream', contactsController.streamBlast);
router.get('/:id', contactsController.getById);
router.patch('/:id', contactsController.update);
router.delete('/:id', contactsController.delete);

export default router;
