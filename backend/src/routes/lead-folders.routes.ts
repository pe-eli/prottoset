import { Router } from 'express';
import { leadFoldersController } from '../controllers/lead-folders.controller';

const router = Router();

router.get('/', leadFoldersController.getAll);
router.post('/', leadFoldersController.create);
router.delete('/:id', leadFoldersController.delete);
router.post('/:id/leads', leadFoldersController.addLeads);
router.delete('/:id/leads', leadFoldersController.removeLeads);

export default router;
