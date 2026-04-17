import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { contactsRepository } from '../modules/contacts/contacts.repository';
import { Contact } from '../types/contacts.types';
import { blastParamSchema, contactCreateSchema, contactUpdateSchema, emailBlastSchema, uuidParamSchema } from '../validation/request.schemas';
import { outboundRunsRepository } from '../jobs/outbound-runs.repository';
import { enqueueEmailBlastJob } from '../jobs/queues';

function openSse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

export const contactsController = {
  async getAll(req: Request, res: Response) {
    try {
      const contacts = await contactsRepository.getAll(req.tenantId!);
      res.json(contacts);
    } catch (err: any) {
      console.error('[Contacts] getAll error:', err.message);
      res.status(500).json({ error: 'Erro ao buscar contatos' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const parsed = uuidParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const contact = await contactsRepository.getById(req.tenantId!, parsed.data.id);
      if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });
      res.json(contact);
    } catch (err: any) {
      console.error('[Contacts] getById error:', err.message);
      res.status(500).json({ error: 'Erro ao buscar contato' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = contactCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const { emails } = parsed.data;

      const now = new Date().toISOString();
      const newContacts: Contact[] = emails
        .map((e: string) => e.trim().toLowerCase())
        .filter((e: string) => e.includes('@'))
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

      if (newContacts.length === 0) {
        return res.status(400).json({ error: 'Nenhum email válido' });
      }

      const result = await contactsRepository.saveMany(req.tenantId!, newContacts);
      res.status(201).json(result);
    } catch (err: any) {
      console.error('[Contacts] create error:', err.message);
      res.status(500).json({ error: 'Erro ao criar contatos' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const paramsParsed = uuidParamSchema.safeParse(req.params);
      if (!paramsParsed.success) {
        return res.status(400).json({ error: paramsParsed.error.issues[0].message });
      }
      const parsed = contactUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const contact = await contactsRepository.update(req.tenantId!, paramsParsed.data.id, parsed.data);
      if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });
      res.json(contact);
    } catch (err: any) {
      console.error('[Contacts] update error:', err.message);
      res.status(500).json({ error: 'Erro ao atualizar contato' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const parsed = uuidParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const deleted = await contactsRepository.delete(req.tenantId!, parsed.data.id);
      if (!deleted) return res.status(404).json({ error: 'Contato não encontrado' });
      res.status(204).send();
    } catch (err: any) {
      console.error('[Contacts] delete error:', err.message);
      res.status(500).json({ error: 'Erro ao excluir contato' });
    }
  },

  /** POST /blast — inicia a fila e retorna o blastId imediatamente */
  async sendBlast(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId!;
      const parsed = emailBlastSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const {
        emails,
        subject,
        body,
        resendApiKey,
        resendFrom,
        batchSize = 10,
        intervalMinSeconds = 15,
        intervalMaxSeconds = 60,
      } = parsed.data;

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

      // Auto-save recipients as contacts (fire-and-forget)
      const now = new Date().toISOString();
      const newContacts: Contact[] = cleanEmails.map((email) => ({
        id: uuid(),
        email,
        name: '',
        phone: '',
        company: '',
        status: 'contacted' as const,
        notes: '',
        channel: 'email' as const,
        lastMessage: `Assunto: ${subject}\n\n${body}`,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      }));
      contactsRepository.saveMany(tenantId, newContacts).catch((err: Error) => {
        console.error('[Blast] Failed to auto-save contacts:', err.message);
      });

      await outboundRunsRepository.createEmailRun(tenantId, {
        runId: blastId,
        targets: cleanEmails,
        subject,
        body,
        batchSize: safeBatchSize,
        intervalMinSeconds: safeMin,
        intervalMaxSeconds: safeMax,
      });

      await enqueueEmailBlastJob({
        tenantId,
        runId: blastId,
        resendApiKey: resendApiKey?.trim() || undefined,
        resendFrom: resendFrom?.trim() || undefined,
      });

      res.json({ blastId, total: cleanEmails.length });
    } catch (err: any) {
      console.error('[Blast] sendBlast error:', err.message);
      res.status(500).json({ error: 'Erro interno ao iniciar disparo' });
    }
  },

  /** GET /blast/:blastId/stream — SSE stream de progresso da fila */
  async streamBlast(req: Request, res: Response) {
    const parsed = blastParamSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const snapshot = await outboundRunsRepository.getRunSnapshot(req.tenantId!, parsed.data.blastId);
    if (!snapshot) {
      res.status(404).json({ error: 'Blast não encontrado' });
      return;
    }

    openSse(res);
    res.write(`event: catchup\ndata: ${JSON.stringify(snapshot.items.map((item, index) => ({
      email: item.target,
      status: item.status === 'skipped' ? 'failed' : item.status,
      index,
      total: snapshot.items.length,
      error: item.error,
    })))}\n\n`);

    const interval = setInterval(async () => {
      const current = await outboundRunsRepository.getRunSnapshot(req.tenantId!, parsed.data.blastId);
      if (!current) {
        clearInterval(interval);
        res.end();
        return;
      }

      res.write(`event: catchup\ndata: ${JSON.stringify(current.items.map((item, index) => ({
        email: item.target,
        status: item.status === 'skipped' ? 'failed' : item.status,
        index,
        total: current.items.length,
        error: item.error,
      })))}\n\n`);

      if (current.status === 'completed' || current.status === 'failed' || current.status === 'cancelled') {
        res.write(`event: done\ndata: ${JSON.stringify({ sent: current.sent, failed: current.failed + current.skipped, total: current.total })}\n\n`);
        clearInterval(interval);
        res.end();
      }
    }, 2000);

    res.on('close', () => clearInterval(interval));
  },
};
