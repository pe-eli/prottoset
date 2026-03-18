import { Router } from 'express';
import { leadsController } from '../controllers/leads.controller';

const router = Router();

router.get('/', leadsController.getAll);
router.get('/:id', leadsController.getById);
router.post('/search', leadsController.search);
router.patch('/:id/status', leadsController.updateStatus);
router.delete('/:id', leadsController.delete);

export default router;
