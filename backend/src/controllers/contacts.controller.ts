import { Request, Response } from 'express';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import { contactsRepository } from '../modules/contacts/contacts.repository';
import { contactMessagesRepository } from '../modules/contacts/contact-messages.repository';
import { contactActivitiesRepository } from '../modules/contacts/contact-activities.repository';
import { Contact } from '../types/contacts.types';
import { blastParamSchema, contactCreateSchema, contactOutboundMessageSchema, contactUpdateSchema, emailBlastSchema, uuidParamSchema } from '../validation/request.schemas';
import { outboundRunsRepository } from '../jobs/outbound-runs.repository';
import { waInstanceRepository } from '../modules/whatsapp/whatsapp-instance.repository';
import { evolutionService } from '../services/evolution.service';
import { aiOrchestrator } from '../modules/ai/ai-orchestrator.service';
import { integrationVaultService } from '../modules/integrations/integration-vault.service';
import { outboxDispatcherService } from '../modules/outbox/outbox-dispatcher.service';
import type { ContactActivity, ContactMessage } from '../types/contacts.types';

function openSse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

function toLegacyActivity(message: ContactMessage): ContactActivity {
  const isOutbound = message.direction === 'outbound';
  return {
    id: `legacy-message-${message.id}`,
    contactId: message.contactId,
    type: isOutbound ? 'MESSAGE_SENT' : 'MANUAL_INTERACTION',
    title: isOutbound ? 'Mensagem enviada (histórico)' : 'Interação manual (histórico)',
    description: message.content,
    metadata: {
      source: 'legacy_contact_messages',
      channel: message.channel,
      direction: message.direction,
    },
    createdAt: message.sentAt || message.createdAt,
  };
}

function logContactEvent(event: string, payload: Record<string, unknown>): void {
  console.info(`[Contacts] ${event} ${JSON.stringify(payload)}`);
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

      if (result.saved.length > 0) {
        await contactActivitiesRepository.createMany(req.tenantId!, result.saved.map((contact) => ({
          contactId: contact.id,
          type: 'CONTACT_CREATED',
          title: 'Contato criado',
          metadata: {
            source: 'manual_import',
            email: contact.email,
          },
          createdBy: req.authUser?.userId,
        })));
      }

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

      const previous = await contactsRepository.getById(req.tenantId!, paramsParsed.data.id);
      const contact = await contactsRepository.update(req.tenantId!, paramsParsed.data.id, parsed.data);
      if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });

      if (previous && parsed.data.status && parsed.data.status !== previous.status) {
        contactActivitiesRepository.create(req.tenantId!, {
          contactId: contact.id,
          type: 'STATUS_CHANGED',
          title: `Status alterado`,
          metadata: { from: previous.status, to: parsed.data.status },
          createdBy: req.authUser?.userId,
        }).catch((err: Error) => console.error('[Contacts] Failed to record status change activity:', err.message));

        logContactEvent('status_changed', {
          tenantId: req.tenantId,
          contactId: contact.id,
          from: previous.status,
          to: parsed.data.status,
          actor: req.authUser?.userId,
        });
      }

      res.json(contact);
    } catch (err: any) {
      console.error('[Contacts] update error:', err.message);
      res.status(500).json({ error: 'Erro ao atualizar contato' });
    }
  },

  async getActivities(req: Request, res: Response) {
    try {
      const paramsParsed = uuidParamSchema.safeParse(req.params);
      if (!paramsParsed.success) {
        return res.status(400).json({ error: paramsParsed.error.issues[0].message });
      }

      const contact = await contactsRepository.getById(req.tenantId!, paramsParsed.data.id);
      if (!contact) {
        return res.status(404).json({ error: 'Contato não encontrado' });
      }

      const [activities, legacyMessages] = await Promise.all([
        contactActivitiesRepository.listByContact(req.tenantId!, contact.id),
        contactMessagesRepository.listByContact(req.tenantId!, contact.id, 120),
      ]);

      // Safe migration fallback: if the tenant still has only legacy messages, render them as timeline activities.
      const fallbackActivities = activities.length === 0
        ? legacyMessages.map(toLegacyActivity)
        : [];

      const timeline = [...activities, ...fallbackActivities].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      res.json(timeline);
    } catch (err: any) {
      console.error('[Contacts] getActivities error:', err.message);
      res.status(500).json({ error: 'Erro ao buscar atividades do contato' });
    }
  },

  async addNote(req: Request, res: Response) {
    try {
      const paramsParsed = uuidParamSchema.safeParse(req.params);
      if (!paramsParsed.success) {
        return res.status(400).json({ error: paramsParsed.error.issues[0].message });
      }

      const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
      if (!content) {
        return res.status(400).json({ error: 'Conteúdo da nota é obrigatório' });
      }
      if (content.length > 2000) {
        return res.status(400).json({ error: 'Nota deve ter no máximo 2000 caracteres' });
      }

      const contact = await contactsRepository.getById(req.tenantId!, paramsParsed.data.id);
      if (!contact) {
        return res.status(404).json({ error: 'Contato não encontrado' });
      }

      const activity = await contactActivitiesRepository.create(req.tenantId!, {
        contactId: contact.id,
        type: 'NOTE_CREATED',
        title: 'Nota adicionada',
        description: content,
        createdBy: req.authUser?.userId,
      });

      logContactEvent('note_created', {
        tenantId: req.tenantId,
        contactId: contact.id,
        actor: req.authUser?.userId,
      });
      res.status(201).json(activity);
    } catch (err: any) {
      console.error('[Contacts] addNote error:', err.message);
      res.status(500).json({ error: 'Erro ao adicionar nota' });
    }
  },

  async createFollowup(req: Request, res: Response) {
    try {
      const paramsParsed = uuidParamSchema.safeParse(req.params);
      if (!paramsParsed.success) {
        return res.status(400).json({ error: paramsParsed.error.issues[0].message });
      }

      const scheduledFor = typeof req.body?.scheduledFor === 'string' ? req.body.scheduledFor.trim() : '';
      const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
      const priority = ['low', 'normal', 'high'].includes(req.body?.priority) ? req.body.priority : 'normal';

      if (!scheduledFor || isNaN(Date.parse(scheduledFor))) {
        return res.status(400).json({ error: 'Data do follow-up inválida' });
      }

      const scheduledDate = new Date(scheduledFor);
      if (scheduledDate <= new Date()) {
        return res.status(400).json({ error: 'Data do follow-up deve ser futura' });
      }

      const contact = await contactsRepository.getById(req.tenantId!, paramsParsed.data.id);
      if (!contact) {
        return res.status(404).json({ error: 'Contato não encontrado' });
      }

      const activity = await contactActivitiesRepository.create(req.tenantId!, {
        contactId: contact.id,
        type: 'FOLLOWUP_CREATED',
        title: 'Follow-up agendado',
        description: note || undefined,
        metadata: {
          scheduledFor: scheduledDate.toISOString(),
          priority,
          done: false,
        },
        createdBy: req.authUser?.userId,
      });

      logContactEvent('followup_created', {
        tenantId: req.tenantId,
        contactId: contact.id,
        scheduledFor: scheduledDate.toISOString(),
        priority,
        actor: req.authUser?.userId,
      });
      res.status(201).json(activity);
    } catch (err: any) {
      console.error('[Contacts] createFollowup error:', err.message);
      res.status(500).json({ error: 'Erro ao agendar follow-up' });
    }
  },

  async completeFollowup(req: Request, res: Response) {
    try {
      const paramsParsed = uuidParamSchema.safeParse(req.params);
      if (!paramsParsed.success) {
        return res.status(400).json({ error: paramsParsed.error.issues[0].message });
      }

      const activityId = typeof req.params?.activityId === 'string' ? req.params.activityId.trim() : '';
      if (!activityId) {
        return res.status(400).json({ error: 'ID da atividade inválido' });
      }

      const done = req.body?.done !== false;
      const activity = await contactActivitiesRepository.updateFollowupDone(req.tenantId!, activityId, done);
      if (!activity) {
        return res.status(404).json({ error: 'Follow-up não encontrado' });
      }

      res.json(activity);
    } catch (err: any) {
      console.error('[Contacts] completeFollowup error:', err.message);
      res.status(500).json({ error: 'Erro ao atualizar follow-up' });
    }
  },

  async sendOutboundMessage(req: Request, res: Response) {
    try {
      const paramsParsed = uuidParamSchema.safeParse(req.params);
      if (!paramsParsed.success) {
        return res.status(400).json({ error: paramsParsed.error.issues[0].message });
      }

      const bodyParsed = contactOutboundMessageSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return res.status(400).json({ error: bodyParsed.error.issues[0].message });
      }

      const tenantId = req.tenantId!;
      const contact = await contactsRepository.getById(tenantId, paramsParsed.data.id);
      if (!contact) {
        return res.status(404).json({ error: 'Contato não encontrado' });
      }

      if (!contact.phone) {
        return res.status(400).json({ error: 'Contato sem telefone para envio via WhatsApp' });
      }

      const waInstance = await waInstanceRepository.findByTenant(tenantId);
      if (!waInstance || waInstance.status !== 'connected') {
        return res.status(400).json({ error: 'WhatsApp não conectado. Conecte antes de enviar.' });
      }

      const { messageMode, promptBase, manualMessage } = bodyParsed.data;
      let message = '';

      if (messageMode === 'manual') {
        message = (manualMessage || '').trim();
        if (!message) {
          return res.status(400).json({ error: 'Mensagem fixa é obrigatória no modo manual.' });
        }
      } else {
        const normalizedPrompt = (promptBase || '').trim();
        if (!normalizedPrompt) {
          return res.status(400).json({ error: 'Prompt da IA é obrigatório no modo IA.' });
        }

        const promptHash = crypto
          .createHash('sha256')
          .update(`${tenantId}:${contact.id}:${normalizedPrompt}`)
          .digest('hex')
          .slice(0, 24);

        const generated = await aiOrchestrator.generate({
          tenantId,
          prompt: normalizedPrompt,
          source: 'blast',
          idempotencyKey: req.header('idempotency-key')?.trim() || `outbound:${contact.id}:${promptHash}`,
          metadata: {
            contactId: contact.id,
            flow: 'contact_activity_center_outbound',
          },
        });
        message = (generated.message || '').trim();
        if (!message) {
          return res.status(500).json({ error: 'Não foi possível gerar uma mensagem de resposta.' });
        }
      }

      const send = await evolutionService.sendMessage(waInstance.instanceName, contact.phone, message);
      if (!send.success) {
        return res.status(502).json({ error: send.error || 'Falha ao enviar mensagem pelo WhatsApp' });
      }

      const sentAt = new Date().toISOString();
      await contactsRepository.update(tenantId, contact.id, {
        status: 'contacted',
        channel: 'whatsapp',
        lastMessage: message,
        lastMessageAt: sentAt,
      });

      await contactMessagesRepository.create(tenantId, {
        contactId: contact.id,
        channel: 'whatsapp',
        direction: 'outbound',
        content: message,
        sentAt,
      });

      await contactActivitiesRepository.create(tenantId, {
        contactId: contact.id,
        type: 'MESSAGE_SENT',
        title: 'Mensagem enviada',
        description: message.length > 260 ? `${message.slice(0, 260)}...` : message,
        metadata: {
          channel: 'whatsapp',
          mode: messageMode,
          sentAt,
        },
        createdBy: req.authUser?.userId,
      });

      logContactEvent('message_sent', {
        tenantId: req.tenantId,
        contactId: contact.id,
        channel: 'whatsapp',
        mode: messageMode,
        actor: req.authUser?.userId,
      });

      res.json({ ok: true, message });
    } catch (err: any) {
      console.error('[Contacts] sendOutboundMessage error:', err.message);
      res.status(500).json({ error: 'Erro ao enviar mensagem outbound no WhatsApp' });
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
      const normalizedApiKey = typeof resendApiKey === 'string' ? resendApiKey.trim() : '';
      const normalizedFrom = typeof resendFrom === 'string' ? resendFrom.trim() : '';

      const existingResend = await integrationVaultService.getSecret(tenantId, 'resend_api_key');
      const effectiveApiKey = normalizedApiKey || existingResend?.secret || '';
      const metadataResendFrom = typeof existingResend?.metadata?.resendFrom === 'string'
        ? existingResend.metadata.resendFrom.trim()
        : '';
      const effectiveFrom = normalizedFrom || metadataResendFrom;

      if (!effectiveApiKey) {
        return res.status(400).json({ error: 'Informe sua RESEND_API_KEY para iniciar o disparo.' });
      }

      if (!effectiveFrom) {
        return res.status(400).json({ error: 'Informe seu RESEND_FROM para iniciar o disparo.' });
      }

      if (normalizedApiKey || normalizedFrom) {
        await integrationVaultService.upsertSecret(tenantId, 'resend_api_key', effectiveApiKey, {
          ...(existingResend?.metadata || {}),
          resendFrom: effectiveFrom,
          updatedBy: tenantId,
        });
      }

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
        resendFrom: effectiveFrom,
        batchSize: safeBatchSize,
        intervalMinSeconds: safeMin,
        intervalMaxSeconds: safeMax,
      });

      void outboxDispatcherService.kick(50);

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
