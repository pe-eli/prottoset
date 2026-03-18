import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { contactsRepository } from '../modules/contacts/contacts.repository';
import { blastQueue } from '../modules/blast/blast.queue';
import { Contact } from '../types/contacts.types';

export const contactsController = {
  getAll(_req: Request, res: Response) {
    const contacts = contactsRepository.getAll();
    res.json(contacts);
  },

  getById(req: Request, res: Response) {
    const contact = contactsRepository.getById(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });
    res.json(contact);
  },

  create(req: Request, res: Response) {
    const { emails } = req.body as { emails: string[] };
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'Lista de emails é obrigatória' });
    }

    const now = new Date().toISOString();
    const newContacts: Contact[] = emails
      .map((e: string) => e.trim().toLowerCase())
      .filter((e: string) => e.length > 0)
      .map((email: string) => ({
        id: uuid(),
        email,
        name: '',
        phone: '',
        company: '',
        status: 'new' as const,
        notes: '',
        createdAt: now,
        updatedAt: now,
      }));

    const result = contactsRepository.saveMany(newContacts);
    res.status(201).json(result);
  },

  update(req: Request, res: Response) {
    const { name, phone, company, status, notes } = req.body;
    const contact = contactsRepository.update(req.params.id, { name, phone, company, status, notes });
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });
    res.json(contact);
  },

  delete(req: Request, res: Response) {
    const deleted = contactsRepository.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Contato não encontrado' });
    res.status(204).send();
  },

  /** POST /blast — inicia a fila e retorna o blastId imediatamente */
  sendBlast(req: Request, res: Response) {
    const {
      emails,
      subject,
      body,
      batchSize = 10,
      intervalMinSeconds = 15,
      intervalMaxSeconds = 60,
    } = req.body as {
      emails: string[];
      subject: string;
      body: string;
      batchSize?: number;
      intervalMinSeconds?: number;
      intervalMaxSeconds?: number;
    };

    if (!emails || emails.length === 0) {
      return res.status(400).json({ error: 'Lista de emails é obrigatória' });
    }
    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Assunto e corpo do email são obrigatórios' });
    }

    const cleanEmails = [...new Set(
      emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'))
    )];

    if (cleanEmails.length === 0) {
      return res.status(400).json({ error: 'Nenhum email válido na lista' });
    }

    const safeBatchSize = Math.max(1, Math.min(50, Number(batchSize) || 10));
    const safeMin = Math.max(5, Math.min(3600, Number(intervalMinSeconds) || 15));
    const safeMax = Math.max(safeMin, Math.min(3600, Number(intervalMaxSeconds) || 60));

    const blastId = uuid();

    // Auto-save recipients as contacts
    const now = new Date().toISOString();
    const newContacts: Contact[] = cleanEmails.map((email) => ({
      id: uuid(),
      email,
      name: '',
      phone: '',
      company: '',
      status: 'contacted' as const,
      notes: `Email enviado: "${subject}" em ${new Date().toLocaleDateString('pt-BR')}`,
      createdAt: now,
      updatedAt: now,
    }));
    contactsRepository.saveMany(newContacts);

    blastQueue.create(blastId, cleanEmails, subject, body, {
      batchSize: safeBatchSize,
      intervalMinSeconds: safeMin,
      intervalMaxSeconds: safeMax,
    });

    res.json({ blastId, total: cleanEmails.length });
  },

  /** GET /blast/:blastId/stream — SSE stream de progresso da fila */
  streamBlast(req: Request, res: Response) {
    const { blastId } = req.params;
    const subscribed = blastQueue.subscribe(blastId, res);
    if (!subscribed) {
      res.status(404).json({ error: 'Blast não encontrado' });
    }
  },
};
