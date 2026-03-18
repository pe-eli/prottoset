import { Router } from 'express';
import { contactsController } from '../controllers/contacts.controller';

const router = Router();

router.get('/', contactsController.getAll);
router.post('/', contactsController.create);
router.post('/blast', contactsController.sendBlast);
router.get('/blast/:blastId/stream', contactsController.streamBlast);
router.get('/:id', contactsController.getById);
router.patch('/:id', contactsController.update);
router.delete('/:id', contactsController.delete);

export default router;
