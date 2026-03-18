import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { waBlastQueue } from '../modules/whatsapp/whatsapp.queue';
import { contactsRepository } from '../modules/contacts/contacts.repository';
import { Contact } from '../types/contacts.types';

export const whatsappController = {
  /** POST /whatsapp/blast — valida, salva contatos e inicia a fila */
  sendBlast(req: Request, res: Response) {
    const {
      phones,
      promptBase,
      batchSize = 10,
      intervalMinSeconds = 15,
      intervalMaxSeconds = 60,
    } = req.body as {
      phones: string[];
      promptBase: string;
      batchSize?: number;
      intervalMinSeconds?: number;
      intervalMaxSeconds?: number;
    };

    if (!phones || phones.length === 0) {
      return res.status(400).json({ error: 'Lista de números é obrigatória' });
    }
    if (!promptBase?.trim()) {
      return res.status(400).json({ error: 'Prompt da mensagem é obrigatório' });
    }

    // Normalize phones: digits only, must have at least 8 digits
    const cleanPhones = [
      ...new Set(
        phones
          .map((p) => p.replace(/\D/g, ''))
          .filter((p) => p.length >= 8),
      ),
    ];

    if (cleanPhones.length === 0) {
      return res.status(400).json({ error: 'Nenhum número válido na lista' });
    }

    const safeBatchSize = Math.max(1, Math.min(50, Number(batchSize) || 10));
    const safeMin = Math.max(5, Math.min(3600, Number(intervalMinSeconds) || 15));
    const safeMax = Math.max(safeMin, Math.min(3600, Number(intervalMaxSeconds) || 60));

    const blastId = uuid();

    // Auto-save phone numbers as contacts
    const now = new Date().toISOString();
    const newContacts: Contact[] = cleanPhones.map((phone) => ({
      id: uuid(),
      email: '',
      name: '',
      phone,
      company: '',
      status: 'contacted' as const,
      notes: `Mensagem WhatsApp enviada em ${new Date().toLocaleDateString('pt-BR')}`,
      createdAt: now,
      updatedAt: now,
    }));
    contactsRepository.saveMany(newContacts);

    waBlastQueue.create(blastId, cleanPhones, promptBase.trim(), {
      batchSize: safeBatchSize,
      intervalMinSeconds: safeMin,
      intervalMaxSeconds: safeMax,
    });

    res.json({ blastId, total: cleanPhones.length });
  },

  /** GET /whatsapp/blast/:blastId/stream — SSE de progresso */
  streamBlast(req: Request, res: Response) {
    const { blastId } = req.params;
    const subscribed = waBlastQueue.subscribe(blastId, res);
    if (!subscribed) {
      res.status(404).json({ error: 'Blast não encontrado' });
    }
  },
};
