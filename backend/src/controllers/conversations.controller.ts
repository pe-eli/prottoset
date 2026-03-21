import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { conversationsRepository } from '../modules/conversations/conversations.repository';
import { conversationsService } from '../modules/conversations/conversations.service';
import { contactsRepository } from '../modules/contacts/contacts.repository';
import type { Contact } from '../types/contacts.types';
import type { ConversationStage } from '../types/conversations.types';

// In-memory SSE subscribers for "start conversation" blast progress
const blastSubscribers = new Map<string, {
  subscribers: Set<Response>;
  phase: 'sending' | 'done';
  sent: number;
  failed: number;
  total: number;
  events: Array<{ event: string; data: object }>; // buffered for late subscribers
  signal: { cancelled: boolean };
}>();

function emitToSubscribers(blastId: string, event: string, data: object) {
  const entry = blastSubscribers.get(blastId);
  if (!entry) return;
  // Buffer event for late-connecting subscribers
  entry.events.push({ event, data });
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const sub of entry.subscribers) {
    try { sub.write(payload); } catch { entry.subscribers.delete(sub); }
  }
}

export const conversationsController = {
  /** POST /conversations/start — start funnel conversations */
  async startConversations(req: Request, res: Response) {
    try {
      const {
        phones,
        promptBase,
        intervalMinSeconds = 15,
        intervalMaxSeconds = 45,
      } = req.body as {
        phones: string[];
        promptBase: string;
        intervalMinSeconds?: number;
        intervalMaxSeconds?: number;
      };

      if (!phones || phones.length === 0) {
        return res.status(400).json({ error: 'Lista de números é obrigatória' });
      }
      if (!promptBase?.trim()) {
        return res.status(400).json({ error: 'Contexto do negócio é obrigatório' });
      }

      const cleanPhones = [
        ...new Set(
          phones.map((p) => p.replace(/\D/g, '')).filter((p) => p.length >= 8),
        ),
      ];

      if (cleanPhones.length === 0) {
        return res.status(400).json({ error: 'Nenhum número válido' });
      }

      const blastId = uuid();

      const signal = { cancelled: false };

      // Set up SSE tracking first
      blastSubscribers.set(blastId, {
        subscribers: new Set(),
        phase: 'sending',
        sent: 0,
        failed: 0,
        total: cleanPhones.length,
        events: [],
        signal,
      });

      const safeMin = Math.max(5, Math.min(3600, Number(intervalMinSeconds) || 15));
      const safeMax = Math.max(safeMin, Math.min(3600, Number(intervalMaxSeconds) || 45));

      // Respond immediately so frontend can connect SSE before blast starts
      res.json({ blastId, total: cleanPhones.length });

      // Auto-save contacts in background (non-critical)
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
        console.error('[Funnel] Failed to auto-save contacts:', err.message);
      });

      // Start blast in background
      conversationsService.startConversations(
        cleanPhones,
        promptBase.trim(),
        { intervalMinSeconds: safeMin, intervalMaxSeconds: safeMax },
        signal,
        (event, data) => {
          emitToSubscribers(blastId, event, data);
          if (event === 'progress') {
            const entry = blastSubscribers.get(blastId);
            const d = data as { status: string };
            if (entry && d.status === 'sent') entry.sent++;
            if (entry && d.status === 'failed') entry.failed++;
          }
        },
      ).then(({ sent, failed }) => {
        const entry = blastSubscribers.get(blastId);
        if (entry) {
          entry.phase = 'done';
          entry.sent = sent;
          entry.failed = failed;
          const payload = `event: done\ndata: ${JSON.stringify({ sent, failed, total: cleanPhones.length })}\n\n`;
          for (const sub of entry.subscribers) {
            try { sub.write(payload); sub.end(); } catch { /* ignore */ }
          }
          entry.subscribers.clear();
        }
      }).catch((err: Error) => {
        console.error(`[Funnel] Background blast error for ${blastId}:`, err.message);
      });
    } catch (err: any) {
      console.error('[Funnel] startConversations error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },

  /** GET /conversations/start/:blastId/stream — SSE progress */
  streamStart(req: Request, res: Response) {
    const { blastId } = req.params;
    const entry = blastSubscribers.get(blastId);
    if (!entry) return res.status(404).json({ error: 'Blast não encontrado' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    if (entry.phase === 'done') {
      res.write(`event: done\ndata: ${JSON.stringify({
        sent: entry.sent, failed: entry.failed, total: entry.total,
      })}\n\n`);
      res.end();
      return;
    }

    // Replay buffered events so late-connecting clients catch up
    if (entry.events.length > 0) {
      res.write(`event: catchup\ndata: ${JSON.stringify({
        events: entry.events,
        total: entry.total,
        sent: entry.sent,
        failed: entry.failed,
      })}\n\n`);
    }

    entry.subscribers.add(res);
    res.on('close', () => entry.subscribers.delete(res));
  },

  /** DELETE /conversations/start/:blastId — cancel funnel blast */
  cancelBlast(req: Request, res: Response) {
    const { blastId } = req.params;
    const entry = blastSubscribers.get(blastId);
    if (!entry) return res.status(404).json({ error: 'Blast não encontrado' });

    entry.signal.cancelled = true;
    res.json({ cancelled: true });
  },

  /** POST /conversations/webhook — Evolution API incoming message */
  handleWebhook(req: Request, res: Response) {
    // Respond immediately to avoid webhook timeout
    res.status(200).json({ received: true });

    const body = req.body;
    console.log('[Webhook] Received:', JSON.stringify(body).slice(0, 500));

    // Evolution API may send different formats
    const event = body.event;
    const data = body.data;

    // Only process incoming text messages
    if (event !== 'messages.upsert') {
      console.log(`[Webhook] Ignored event: ${event}`);
      return;
    }
    if (!data?.key?.remoteJid) {
      console.log('[Webhook] No remoteJid in data.key');
      return;
    }
    if (data.key.fromMe) {
      console.log('[Webhook] Ignored: fromMe');
      return;
    }

    // Ignore group messages
    if (data.key.remoteJid.includes('@g.us')) {
      console.log('[Webhook] Ignored: group message');
      return;
    }

    const text = data.message?.conversation
      || data.message?.extendedTextMessage?.text
      || '';
    if (!text.trim()) {
      console.log('[Webhook] Ignored: empty text. Message keys:', Object.keys(data.message || {}));
      return;
    }

    // Extract phone from JID
    const phone = data.key.remoteJid.replace(/@.*$/, '');
    console.log(`[Webhook] Processing message from ${phone}: "${text.slice(0, 100)}"`);

    // Process in background
    conversationsService.handleIncomingMessage(phone, text).catch((err) => {
      console.error(`[Webhook] Error: ${err.message}`);
    });
  },

  /** GET /conversations — list all conversations */
  async getAll(_req: Request, res: Response) {
    try {
      const conversations = await conversationsRepository.getAll();
      conversations.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      res.json(conversations);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** GET /conversations/:id — get single conversation */
  async getById(req: Request, res: Response) {
    try {
      const conv = await conversationsRepository.getById(req.params.id);
      if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' });
      res.json(conv);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** PATCH /conversations/:id — update conversation */
  async updateConversation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { autoReply, stage } = req.body as {
        autoReply?: boolean;
        stage?: ConversationStage;
      };

      const updates: Partial<{ autoReply: boolean; stage: ConversationStage }> = {};
      if (typeof autoReply === 'boolean') updates.autoReply = autoReply;
      if (stage) updates.stage = stage;

      const updated = await conversationsRepository.update(id, updates);
      if (!updated) return res.status(404).json({ error: 'Conversa não encontrada' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /** DELETE /conversations/:id — delete conversation */
  async deleteConversation(req: Request, res: Response) {
    try {
      const ok = await conversationsRepository.delete(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Conversa não encontrada' });
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
