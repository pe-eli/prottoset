import { Request, Response } from 'express';
import { quoteService } from '../services/quote.service';
import { quoteSchema, uuidParamSchema } from '../validation/request.schemas';
import { usageRepository } from '../modules/subscriptions/usage.repository';

export const quoteController = {
  async generatePdf(req: Request, res: Response): Promise<void> {
    try {
      const parsed = quoteSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }

      const result = await quoteService.generatePdf(req.tenantId!, parsed.data);
      await usageRepository.incrementUsage(req.tenantId!, 'quotes_used');
      res.json({ id: result.id, pdfUrl: `/api/quotes/${result.id}/pdf` });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
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
      const quote = await quoteService.getById(req.tenantId!, id);
      if (!quote) {
        res.status(404).json({ error: 'Orçamento não encontrado' });
        return;
      }

      const pdfPath = await quoteService.getPdfPath(req.tenantId!, id);

      if (!pdfPath) {
        res.status(404).json({ error: 'PDF não encontrado' });
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="orcamento-${id}.pdf"`);
      res.sendFile(pdfPath);
    } catch (error) {
      console.error('Erro ao baixar PDF:', error);
      res.status(500).json({ error: 'Erro ao baixar o PDF' });
    }
  },

  async list(req: Request, res: Response): Promise<void> {
    try {
      const quotes = await quoteService.getAll(req.tenantId!);
      res.json(quotes);
    } catch (error) {
      console.error('Erro ao listar orçamentos:', error);
      res.status(500).json({ error: 'Erro ao listar orçamentos' });
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const parsed = uuidParamSchema.safeParse(req.params);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }

      const { id } = parsed.data;
      const quote = await quoteService.getById(req.tenantId!, id);

      if (!quote) {
        res.status(404).json({ error: 'Orçamento não encontrado' });
        return;
      }

      res.json(quote);
    } catch (error) {
      console.error('Erro ao buscar orçamento:', error);
      res.status(500).json({ error: 'Erro ao buscar orçamento' });
    }
  },
};
