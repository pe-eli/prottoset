import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { queuesRepository } from '../modules/queues/queues.repository';

export const queuesController = {
  async getAll(_req: Request, res: Response) {
    try {
      const queues = await queuesRepository.getAll();
      res.json(queues);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Nome da fila é obrigatório' });
        return;
      }

      const queue = await queuesRepository.create({
        id: uuid(),
        name: name.trim(),
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
      const deleted = await queuesRepository.delete(req.params.id);
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
      const { phones } = req.body;
      if (!Array.isArray(phones) || phones.length === 0) {
        res.status(400).json({ error: 'Lista de telefones é obrigatória' });
        return;
      }

      const updated = await queuesRepository.addPhones(req.params.id, phones);
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
      const updated = await queuesRepository.removePhone(req.params.id, req.params.phone);
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
      const { name } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Nome é obrigatório' });
        return;
      }
      const updated = await queuesRepository.rename(req.params.id, name.trim());
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
      const { sourceIds, name } = req.body as { sourceIds: string[]; name: string };
      if (!Array.isArray(sourceIds) || sourceIds.length < 2) {
        res.status(400).json({ error: 'Selecione pelo menos 2 filas para juntar' });
        return;
      }
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Nome da fila resultante é obrigatório' });
        return;
      }
      const merged = await queuesRepository.merge(sourceIds, name.trim());
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
