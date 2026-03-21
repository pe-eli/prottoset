import { Router } from 'express';
import { conversationsController } from '../controllers/conversations.controller';

const router = Router();

// Static routes BEFORE dynamic
router.post('/start', conversationsController.startConversations);
router.get('/start/:blastId/stream', conversationsController.streamStart);
router.delete('/start/:blastId', conversationsController.cancelBlast);
router.post('/webhook', conversationsController.handleWebhook);
router.get('/', conversationsController.getAll);
router.get('/:id', conversationsController.getById);
router.patch('/:id', conversationsController.updateConversation);
router.delete('/:id', conversationsController.deleteConversation);

export default router;
