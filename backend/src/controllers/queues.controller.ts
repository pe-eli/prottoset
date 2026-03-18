import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { queuesRepository } from '../modules/queues/queues.repository';

export const queuesController = {
  getAll(_req: Request, res: Response) {
    const queues = queuesRepository.getAll();
    res.json(queues);
  },

  create(req: Request, res: Response) {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Nome da fila é obrigatório' });
      return;
    }

    const queue = queuesRepository.create({
      id: uuid(),
      name: name.trim(),
      phones: [],
      createdAt: new Date().toISOString(),
    });

    res.status(201).json(queue);
  },

  delete(req: Request, res: Response) {
    const deleted = queuesRepository.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Fila não encontrada' });
      return;
    }
    res.status(204).send();
  },

  addPhones(req: Request, res: Response) {
    const { phones } = req.body;
    if (!Array.isArray(phones) || phones.length === 0) {
      res.status(400).json({ error: 'Lista de telefones é obrigatória' });
      return;
    }

    const updated = queuesRepository.addPhones(req.params.id, phones);
    if (!updated) {
      res.status(404).json({ error: 'Fila não encontrada' });
      return;
    }
    res.json(updated);
  },

  removePhone(req: Request, res: Response) {
    const updated = queuesRepository.removePhone(req.params.id, req.params.phone);
    if (!updated) {
      res.status(404).json({ error: 'Fila não encontrada' });
      return;
    }
    res.json(updated);
  },

  rename(req: Request, res: Response) {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Nome é obrigatório' });
      return;
    }
    const updated = queuesRepository.rename(req.params.id, name.trim());
    if (!updated) {
      res.status(404).json({ error: 'Fila não encontrada' });
      return;
    }
    res.json(updated);
  },

  merge(req: Request, res: Response) {
    const { sourceIds, name } = req.body as { sourceIds: string[]; name: string };
    if (!Array.isArray(sourceIds) || sourceIds.length < 2) {
      res.status(400).json({ error: 'Selecione pelo menos 2 filas para juntar' });
      return;
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Nome da fila resultante é obrigatório' });
      return;
    }
    const merged = queuesRepository.merge(sourceIds, name.trim());
    if (!merged) {
      res.status(404).json({ error: 'Filas não encontradas' });
      return;
    }
    res.json(merged);
  },
};
