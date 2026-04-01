import { Request, Response } from 'express';
import { scheduleRepository } from '../modules/schedule/schedule.repository';
import { CreateScheduleItemParams } from '../types/schedule.types';

export const scheduleController = {
  async getAll(_req: Request, res: Response) {
    try {
      const items = await scheduleRepository.getAll();
      res.json(items);
    } catch (err) {
      console.error('[Schedule] Error fetching items:', err);
      res.status(500).json({ error: 'Erro ao buscar agenda' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const item = await scheduleRepository.getById(req.params.id);
      if (!item) return res.status(404).json({ error: 'Item não encontrado' });
      res.json(item);
    } catch (err) {
      console.error('[Schedule] Error fetching item:', err);
      res.status(500).json({ error: 'Erro ao buscar item' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const params = req.body as CreateScheduleItemParams;
      if (!params.title || !params.category || !params.startTime || !params.endTime) {
        return res.status(400).json({ error: 'Campos obrigatórios: title, category, startTime, endTime' });
      }
      if (!params.date && !params.recurrence) {
        return res.status(400).json({ error: 'Informe date (evento único) ou recurrence (recorrente)' });
      }
      const item = await scheduleRepository.create(params);
      res.status(201).json(item);
    } catch (err) {
      console.error('[Schedule] Error creating item:', err);
      res.status(500).json({ error: 'Erro ao criar item' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const item = await scheduleRepository.update(req.params.id, req.body);
      if (!item) return res.status(404).json({ error: 'Item não encontrado' });
      res.json(item);
    } catch (err) {
      console.error('[Schedule] Error updating item:', err);
      res.status(500).json({ error: 'Erro ao atualizar item' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const deleted = await scheduleRepository.delete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Item não encontrado' });
      res.status(204).send();
    } catch (err) {
      console.error('[Schedule] Error deleting item:', err);
      res.status(500).json({ error: 'Erro ao excluir item' });
    }
  },
};
