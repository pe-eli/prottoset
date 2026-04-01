import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { waBlastQueue } from '../modules/whatsapp/whatsapp.queue';
import { contactsRepository } from '../modules/contacts/contacts.repository';
import { Contact } from '../types/contacts.types';

export const whatsappController = {
  /** POST /whatsapp/blast — valida, salva contatos e inicia a fila */
  async sendBlast(req: Request, res: Response) {
    try {
      const {
        phones,
        batchSize = 10,
        intervalMinSeconds = 15,
        intervalMaxSeconds = 60,
      } = req.body as {
        phones: string[];
        batchSize?: number;
        intervalMinSeconds?: number;
        intervalMaxSeconds?: number;
      };

      if (!phones || phones.length === 0) {
        return res.status(400).json({ error: 'Lista de números é obrigatória' });
      }

      // Normalize phones: digits only, must have at least 8 digits
      const cleanPhones = [
        ...new Set(
          phones
            .map((p) => (typeof p === 'string' ? p : String(p)).replace(/\D/g, ''))
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

      // Auto-save phone numbers as contacts (fire-and-forget)
      const now = new Date().toISOString();
      const newContacts: Contact[] = cleanPhones.map((phone) => ({
        id: uuid(),
        email: '',
        name: '',
        phone,
        company: '',
        status: 'contacted' as const,
        notes: '',
        channel: 'whatsapp' as const,
        createdAt: now,
        updatedAt: now,
      }));
      contactsRepository.saveMany(newContacts).catch((err: Error) => {
        console.error('[WhatsApp] Failed to auto-save contacts:', err.message);
      });

      const entry = waBlastQueue.create(blastId, cleanPhones, {
        batchSize: safeBatchSize,
        intervalMinSeconds: safeMin,
        intervalMaxSeconds: safeMax,
      });

      // After blast finishes, update contacts with the actual message sent
      let checkCount = 0;
      const MAX_CHECKS = 1800; // 1 hour max (2s * 1800)
      const checkDone = setInterval(async () => {
        checkCount++;
        if (checkCount > MAX_CHECKS) {
          clearInterval(checkDone);
          console.warn(`[WhatsApp] checkDone timed out for blast ${blastId}`);
          return;
        }
        if (entry.phase === 'done' || entry.phase === 'cancelled') {
          clearInterval(checkDone);
          try {
            const contacts = await contactsRepository.getAll();
            const sentAt = new Date().toISOString();
            for (const job of entry.jobs) {
              if (job.message && job.status === 'sent') {
                const cleanPhone = job.phone.replace(/\D/g, '');
                const contact = contacts.find((c) => c.phone === cleanPhone);
                if (contact) {
                  await contactsRepository.update(contact.id, {
                    lastMessage: job.message,
                    lastMessageAt: sentAt,
                  });
                }
              }
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[WhatsApp] Failed to update contacts after blast:', message);
          }
        }
      }, 2000);

      res.json({ blastId, total: cleanPhones.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[WhatsApp] sendBlast error:', message);
      res.status(500).json({ error: 'Erro interno ao iniciar disparo' });
    }
  },

  /** POST /whatsapp/blast/:blastId/cancel */
  cancelBlast(req: Request, res: Response) {
    const { blastId } = req.params;
    const ok = waBlastQueue.cancel(blastId);
    if (!ok) return res.status(404).json({ error: 'Blast não encontrado ou já finalizado' });
    res.json({ cancelled: true });
  },

  /** GET /whatsapp/blast/:blastId/status */
  statusBlast(req: Request, res: Response) {
    const { blastId } = req.params;
    const status = waBlastQueue.status(blastId);
    if (!status) return res.status(404).json({ error: 'Blast não encontrado' });
    res.json(status);
  },
  streamBlast(req: Request, res: Response) {
    const { blastId } = req.params;
    const subscribed = waBlastQueue.subscribe(blastId, res);
    if (!subscribed) {
      res.status(404).json({ error: 'Blast não encontrado' });
    }
  },
};
