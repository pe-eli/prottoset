import { Router } from 'express';
import { quoteController } from '../controllers/quote.controller';
import { requireActiveSubscription } from '../middleware/subscription.middleware';

const router = Router();

router.post('/generate-pdf', requireActiveSubscription('quotes'), quoteController.generatePdf);
router.get('/:id/pdf', quoteController.downloadPdf);
router.get('/', quoteController.list);
router.get('/:id', quoteController.getById);

export default router;
