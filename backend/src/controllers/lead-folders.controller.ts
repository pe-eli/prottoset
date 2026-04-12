import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { leadFoldersRepository } from '../modules/leads/lead-folders.repository';
import { leadFolderCreateSchema, leadFolderLeadsSchema, uuidParamSchema } from '../validation/request.schemas';

export const leadFoldersController = {
  async getAll(req: Request, res: Response) {
    try {
      const folders = await leadFoldersRepository.getAll(req.tenantId!);
      res.json(folders);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = leadFolderCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const folder = await leadFoldersRepository.create(req.tenantId!, {
        id: uuid(),
        name: parsed.data.name,
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
      const parsed = uuidParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const deleted = await leadFoldersRepository.delete(req.tenantId!, parsed.data.id);
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
      const paramsParsed = uuidParamSchema.safeParse(req.params);
      if (!paramsParsed.success) {
        return res.status(400).json({ error: paramsParsed.error.issues[0].message });
      }
      const bodyParsed = leadFolderLeadsSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return res.status(400).json({ error: bodyParsed.error.issues[0].message });
      }
      const updated = await leadFoldersRepository.addLeads(req.tenantId!, paramsParsed.data.id, bodyParsed.data.leadIds);
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
      const paramsParsed = uuidParamSchema.safeParse(req.params);
      if (!paramsParsed.success) {
        return res.status(400).json({ error: paramsParsed.error.issues[0].message });
      }
      const bodyParsed = leadFolderLeadsSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return res.status(400).json({ error: bodyParsed.error.issues[0].message });
      }
      const updated = await leadFoldersRepository.removeLeads(req.tenantId!, paramsParsed.data.id, bodyParsed.data.leadIds);
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
