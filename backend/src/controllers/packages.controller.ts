import { Request, Response } from 'express';
import { packagesService } from '../services/packages.service';
import { packagesQuoteSchema, uuidParamSchema } from '../validation/request.schemas';
import { billingService } from '../modules/subscriptions/billing.service';

export const packagesController = {
  async generatePdf(req: Request, res: Response): Promise<void> {
    try {
      const parsed = packagesQuoteSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }

      const result = await packagesService.generatePdf(req.tenantId!, parsed.data);

      const consumed = await billingService.consume({
        tenantId: req.tenantId!,
        type: 'PDF',
        amount: 1,
        idempotencyKey: `pdf:packages:${req.tenantId}:${result.id}`,
        metadata: { source: 'packages.generatePdf', quoteId: result.id },
      });

      if (!consumed.consumed) {
        res.status(429).json({ error: 'Limite de PDF atingido para este período.' });
        return;
      }

      res.json({ id: result.id, pdfUrl: `/api/packages/${result.id}/pdf` });
    } catch (error) {
      console.error('Erro ao gerar proposta de pacotes:', error);
      res.status(500).json({ error: 'Erro ao gerar o PDF' });
    }
  },

  async downloadPdf(req: Request, res: Response): Promise<void> {
    try {
      const parsed = uuidParamSchema.safeParse(req.params);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }

      const { id } = parsed.data;
      const pdfPath = packagesService.getPdfPath(req.tenantId!, id);

      if (!pdfPath) {
        res.status(404).json({ error: 'PDF não encontrado' });
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="proposta-${id}.pdf"`);
      res.sendFile(pdfPath);
    } catch (error) {
      console.error('Erro ao baixar proposta:', error);
      res.status(500).json({ error: 'Erro ao baixar o PDF' });
    }
  },
};
