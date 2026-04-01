import { Request, Response } from 'express';
import { productivityRepository } from '../modules/productivity/productivity.repository';
import { CreateDailyEntryParams } from '../types/productivity.types';

export const productivityController = {
  async getAll(_req: Request, res: Response) {
    try {
      const entries = await productivityRepository.getAll();
      res.json(entries);
    } catch (err) {
      console.error('[Productivity] Error fetching entries:', err);
      res.status(500).json({ error: 'Erro ao buscar entradas' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const entry = await productivityRepository.getById(req.params.id);
      if (!entry) return res.status(404).json({ error: 'Entrada não encontrada' });
      res.json(entry);
    } catch (err) {
      console.error('[Productivity] Error fetching entry:', err);
      res.status(500).json({ error: 'Erro ao buscar entrada' });
    }
  },

  async getByWeek(req: Request, res: Response) {
    try {
      const entries = await productivityRepository.getByWeek(req.params.week);
      res.json(entries);
    } catch (err) {
      console.error('[Productivity] Error fetching week:', err);
      res.status(500).json({ error: 'Erro ao buscar semana' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const params = req.body as CreateDailyEntryParams;
      if (!params.date || params.prottocodeHours == null) {
        return res.status(400).json({ error: 'Campos obrigatórios: date, prottocodeHours' });
      }
      const entry = await productivityRepository.create(params);
      res.status(201).json(entry);
    } catch (err) {
      console.error('[Productivity] Error creating entry:', err);
      res.status(500).json({ error: 'Erro ao criar entrada' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const entry = await productivityRepository.update(req.params.id, req.body);
      if (!entry) return res.status(404).json({ error: 'Entrada não encontrada' });
      res.json(entry);
    } catch (err) {
      console.error('[Productivity] Error updating entry:', err);
      res.status(500).json({ error: 'Erro ao atualizar entrada' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const deleted = await productivityRepository.delete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Entrada não encontrada' });
      res.status(204).send();
    } catch (err) {
      console.error('[Productivity] Error deleting entry:', err);
      res.status(500).json({ error: 'Erro ao excluir entrada' });
    }
  },
};
