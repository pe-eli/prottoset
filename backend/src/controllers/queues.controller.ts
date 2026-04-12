import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { queuesRepository } from '../modules/queues/queues.repository';
import { queueCreateSchema, queueMergeSchema, queuePhonesSchema, queuePhoneParamSchema, queueRenameSchema, uuidParamSchema } from '../validation/request.schemas';

export const queuesController = {
  async getAll(req: Request, res: Response) {
    try {
      const queues = await queuesRepository.getAll(req.tenantId!);
      res.json(queues);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = queueCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const queue = await queuesRepository.create(req.tenantId!, {
        id: uuid(),
        name: parsed.data.name,
        phones: [],
        createdAt: new Date().toISOString(),
      });

      res.status(201).json(queue);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const parsed = uuidParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const deleted = await queuesRepository.delete(req.tenantId!, parsed.data.id);
      if (!deleted) {
        res.status(404).json({ error: 'Fila não encontrada' });
        return;
      }
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async addPhones(req: Request, res: Response) {
    try {
      const paramsParsed = uuidParamSchema.safeParse(req.params);
      if (!paramsParsed.success) {
        return res.status(400).json({ error: paramsParsed.error.issues[0].message });
      }
      const bodyParsed = queuePhonesSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return res.status(400).json({ error: bodyParsed.error.issues[0].message });
      }

      const updated = await queuesRepository.addPhones(req.tenantId!, paramsParsed.data.id, bodyParsed.data.phones);
      if (!updated) {
        res.status(404).json({ error: 'Fila não encontrada' });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async removePhone(req: Request, res: Response) {
    try {
      const parsed = queuePhoneParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const updated = await queuesRepository.removePhone(req.tenantId!, parsed.data.id, parsed.data.phone);
      if (!updated) {
        res.status(404).json({ error: 'Fila não encontrada' });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async rename(req: Request, res: Response) {
    try {
      const paramsParsed = uuidParamSchema.safeParse(req.params);
      if (!paramsParsed.success) {
        return res.status(400).json({ error: paramsParsed.error.issues[0].message });
      }
      const bodyParsed = queueRenameSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return res.status(400).json({ error: bodyParsed.error.issues[0].message });
      }
      const updated = await queuesRepository.rename(req.tenantId!, paramsParsed.data.id, bodyParsed.data.name);
      if (!updated) {
        res.status(404).json({ error: 'Fila não encontrada' });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async merge(req: Request, res: Response) {
    try {
      const parsed = queueMergeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const merged = await queuesRepository.merge(req.tenantId!, parsed.data.sourceIds, parsed.data.name);
      if (!merged) {
        res.status(404).json({ error: 'Filas não encontradas' });
        return;
      }
      res.json(merged);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
