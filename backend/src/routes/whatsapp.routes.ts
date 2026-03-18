import { Router } from 'express';
import { whatsappController } from '../controllers/whatsapp.controller';

const router = Router();

// Static routes BEFORE dynamic
router.post('/blast', whatsappController.sendBlast);
router.get('/blast/:blastId/stream', whatsappController.streamBlast);

export default router;
