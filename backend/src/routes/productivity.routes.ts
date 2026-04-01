import { Router } from 'express';
import { productivityController } from '../controllers/productivity.controller';

const router = Router();

router.get('/', productivityController.getAll);
router.post('/', productivityController.create);
router.get('/week/:week', productivityController.getByWeek);
router.get('/:id', productivityController.getById);
router.patch('/:id', productivityController.update);
router.delete('/:id', productivityController.delete);

export default router;
