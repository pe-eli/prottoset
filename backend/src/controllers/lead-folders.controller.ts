import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { leadFoldersRepository } from '../modules/leads/lead-folders.repository';

export const leadFoldersController = {
  async getAll(_req: Request, res: Response) {
    try {
      const folders = await leadFoldersRepository.getAll();
      res.json(folders);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { name } = req.body as { name?: string };
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Nome da pasta é obrigatório' });
        return;
      }
      const folder = await leadFoldersRepository.create({
        id: uuid(),
        name: name.trim(),
        leadIds: [],
        color: 'blue',
        createdAt: new Date().toISOString(),
      });
      res.status(201).json(folder);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const deleted = await leadFoldersRepository.delete(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Pasta não encontrada' });
        return;
      }
      res.status(204).send();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },

  async addLeads(req: Request, res: Response) {
    try {
      const { leadIds } = req.body as { leadIds?: string[] };
      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        res.status(400).json({ error: 'Lista de leads é obrigatória' });
        return;
      }
      const updated = await leadFoldersRepository.addLeads(req.params.id, leadIds);
      if (!updated) {
        res.status(404).json({ error: 'Pasta não encontrada' });
        return;
      }
      res.json(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },

  async removeLeads(req: Request, res: Response) {
    try {
      const { leadIds } = req.body as { leadIds?: string[] };
      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        res.status(400).json({ error: 'Lista de leads é obrigatória' });
        return;
      }
      const updated = await leadFoldersRepository.removeLeads(req.params.id, leadIds);
      if (!updated) {
        res.status(404).json({ error: 'Pasta não encontrada' });
        return;
      }
      res.json(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
};
