import { Router } from 'express';
import { scheduleController } from '../controllers/schedule.controller';

const router = Router();

router.get('/', scheduleController.getAll);
router.post('/', scheduleController.create);
router.get('/:id', scheduleController.getById);
router.patch('/:id', scheduleController.update);
router.delete('/:id', scheduleController.delete);

export default router;
