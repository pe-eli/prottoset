import { Request, Response } from 'express';
import { packagesService } from '../services/packages.service';
import { PackagesQuote } from '../types/packages.types';

export const packagesController = {
  async generatePdf(req: Request, res: Response): Promise<void> {
    try {
      const quote: PackagesQuote = req.body;

      if (!quote.id || !quote.clientName || !quote.projectName || !Array.isArray(quote.plans)) {
        res.status(400).json({ error: 'Dados da proposta incompletos' });
        return;
      }

      if (quote.plans.length === 0) {
        res.status(400).json({ error: 'Inclua ao menos um plano' });
        return;
      }

      const result = await packagesService.generatePdf(quote);
      res.json({ id: result.id, pdfUrl: `/api/packages/${result.id}/pdf` });
    } catch (error) {
      console.error('Erro ao gerar proposta de pacotes:', error);
      res.status(500).json({ error: 'Erro ao gerar o PDF' });
    }
  },

  async downloadPdf(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const pdfPath = packagesService.getPdfPath(id);

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
