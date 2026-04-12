import { Request, Response } from 'express';
import { productivityRepository } from '../modules/productivity/productivity.repository';
import { productivityCreateSchema, productivityUpdateSchema, uuidParamSchema, weekParamSchema } from '../validation/request.schemas';

export const productivityController = {
  async getAll(req: Request, res: Response) {
    try {
      const entries = await productivityRepository.getAll(req.tenantId!);
      res.json(entries);
    } catch (err) {
      console.error('[Productivity] Error fetching entries:', err);
      res.status(500).json({ error: 'Erro ao buscar entradas' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const parsed = uuidParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const entry = await productivityRepository.getById(req.tenantId!, parsed.data.id);
      if (!entry) return res.status(404).json({ error: 'Entrada não encontrada' });
      res.json(entry);
    } catch (err) {
      console.error('[Productivity] Error fetching entry:', err);
      res.status(500).json({ error: 'Erro ao buscar entrada' });
    }
  },

  async getByWeek(req: Request, res: Response) {
    try {
      const parsed = weekParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const entries = await productivityRepository.getByWeek(req.tenantId!, parsed.data.week);
      res.json(entries);
    } catch (err) {
      console.error('[Productivity] Error fetching week:', err);
      res.status(500).json({ error: 'Erro ao buscar semana' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = productivityCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const entry = await productivityRepository.create(req.tenantId!, parsed.data);
      res.status(201).json(entry);
    } catch (err) {
      console.error('[Productivity] Error creating entry:', err);
      res.status(500).json({ error: 'Erro ao criar entrada' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const paramsParsed = uuidParamSchema.safeParse(req.params);
      if (!paramsParsed.success) {
        return res.status(400).json({ error: paramsParsed.error.issues[0].message });
      }
      const bodyParsed = productivityUpdateSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return res.status(400).json({ error: bodyParsed.error.issues[0].message });
      }
      const entry = await productivityRepository.update(req.tenantId!, paramsParsed.data.id, bodyParsed.data);
      if (!entry) return res.status(404).json({ error: 'Entrada não encontrada' });
      res.json(entry);
    } catch (err) {
      console.error('[Productivity] Error updating entry:', err);
      res.status(500).json({ error: 'Erro ao atualizar entrada' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const parsed = uuidParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const deleted = await productivityRepository.delete(req.tenantId!, parsed.data.id);
      if (!deleted) return res.status(404).json({ error: 'Entrada não encontrada' });
      res.status(204).send();
    } catch (err) {
      console.error('[Productivity] Error deleting entry:', err);
      res.status(500).json({ error: 'Erro ao excluir entrada' });
    }
  },
};
