import { Router } from 'express';
import { packagesController } from '../controllers/packages.controller';

const router = Router();

router.post('/generate-pdf', packagesController.generatePdf);
router.get('/:id/pdf', packagesController.downloadPdf);

export default router;
