import { Request, Response } from 'express';
import { scheduleRepository } from '../modules/schedule/schedule.repository';
import { scheduleCreateSchema, scheduleUpdateSchema, uuidParamSchema } from '../validation/request.schemas';

export const scheduleController = {
  async getAll(req: Request, res: Response) {
    try {
      const items = await scheduleRepository.getAll(req.tenantId!);
      res.json(items);
    } catch (err) {
      console.error('[Schedule] Error fetching items:', err);
      res.status(500).json({ error: 'Erro ao buscar agenda' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const parsed = uuidParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const item = await scheduleRepository.getById(req.tenantId!, parsed.data.id);
      if (!item) return res.status(404).json({ error: 'Item não encontrado' });
      res.json(item);
    } catch (err) {
      console.error('[Schedule] Error fetching item:', err);
      res.status(500).json({ error: 'Erro ao buscar item' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = scheduleCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const item = await scheduleRepository.create(req.tenantId!, parsed.data);
      res.status(201).json(item);
    } catch (err) {
      console.error('[Schedule] Error creating item:', err);
      res.status(500).json({ error: 'Erro ao criar item' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const paramsParsed = uuidParamSchema.safeParse(req.params);
      if (!paramsParsed.success) {
        return res.status(400).json({ error: paramsParsed.error.issues[0].message });
      }
      const bodyParsed = scheduleUpdateSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return res.status(400).json({ error: bodyParsed.error.issues[0].message });
      }
      const updatePayload = {
        ...bodyParsed.data,
        date: bodyParsed.data.date ?? undefined,
        recurrence: bodyParsed.data.recurrence ?? undefined,
      };
      const item = await scheduleRepository.update(req.tenantId!, paramsParsed.data.id, updatePayload);
      if (!item) return res.status(404).json({ error: 'Item não encontrado' });
      res.json(item);
    } catch (err) {
      console.error('[Schedule] Error updating item:', err);
      res.status(500).json({ error: 'Erro ao atualizar item' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const parsed = uuidParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const deleted = await scheduleRepository.delete(req.tenantId!, parsed.data.id);
      if (!deleted) return res.status(404).json({ error: 'Item não encontrado' });
      res.status(204).send();
    } catch (err) {
      console.error('[Schedule] Error deleting item:', err);
      res.status(500).json({ error: 'Erro ao excluir item' });
    }
  },
};
