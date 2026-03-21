import { Request, Response } from 'express';
import { leadsService } from '../modules/leads/leads.service';
import { LeadSearchParams, LeadStatus } from '../types/leads.types';

const VALID_STATUSES: LeadStatus[] = ['new', 'contacted', 'replied', 'converted', 'ignored'];

export const leadsController = {
  async search(req: Request, res: Response): Promise<void> {
    try {
      const { searchTerm, city, maxResults } = req.body as LeadSearchParams;

      if (!searchTerm?.trim() || !city?.trim()) {
        res.status(400).json({ error: 'searchTerm e city são obrigatórios' });
        return;
      }

      const safeMaxResults = Math.min(100, Math.max(1, Number(maxResults) || 50));
      const result = await leadsService.search({ searchTerm: searchTerm.trim(), city: city.trim(), maxResults: safeMaxResults });
      res.json(result);
    } catch (err: any) {
      console.error('[Leads] search error:', err.message);
      res.status(500).json({ error: 'Erro ao buscar leads' });
    }
  },

  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const leads = await leadsService.getAll();
      res.json(leads);
    } catch (err: any) {
      console.error('[Leads] getAll error:', err.message);
      res.status(500).json({ error: 'Erro ao listar leads' });
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const lead = await leadsService.getById(id);
      if (!lead) {
        res.status(404).json({ error: 'Lead not found' });
        return;
      }
      res.json(lead);
    } catch (err: any) {
      console.error('[Leads] getById error:', err.message);
      res.status(500).json({ error: 'Erro ao buscar lead' });
    }
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !VALID_STATUSES.includes(status)) {
        res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
        return;
      }

      const lead = await leadsService.updateStatus(id, status);
      if (!lead) {
        res.status(404).json({ error: 'Lead not found' });
        return;
      }

      res.json(lead);
    } catch (err: any) {
      console.error('[Leads] updateStatus error:', err.message);
      res.status(500).json({ error: 'Erro ao atualizar lead' });
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await leadsService.delete(id);
      if (!deleted) {
        res.status(404).json({ error: 'Lead not found' });
        return;
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Leads] delete error:', err.message);
      res.status(500).json({ error: 'Erro ao excluir lead' });
    }
  },
};
