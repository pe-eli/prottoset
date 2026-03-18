import { Router } from 'express';
import { queuesController } from '../controllers/queues.controller';

const router = Router();

router.get('/', queuesController.getAll);
router.post('/', queuesController.create);
router.post('/merge', queuesController.merge);
router.patch('/:id', queuesController.rename);
router.delete('/:id', queuesController.delete);
router.post('/:id/phones', queuesController.addPhones);
router.delete('/:id/phones/:phone', queuesController.removePhone);

export default router;
