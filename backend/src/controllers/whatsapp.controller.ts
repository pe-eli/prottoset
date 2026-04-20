import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { contactsRepository } from '../modules/contacts/contacts.repository';
import { blastParamSchema, whatsappBlastSchema, whatsappPromptTestSchema } from '../validation/request.schemas';
import { outboundRunsRepository } from '../jobs/outbound-runs.repository';
import { enqueueWhatsAppBlastJob } from '../jobs/queues';
import { deepseekService } from '../services/deepseek.service';

function openSse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

export const whatsappController = {
  /** POST /whatsapp/prompt/test — gera 3 variações para validar prompt */
  async testPrompt(req: Request, res: Response) {
    try {
      const parsed = whatsappPromptTestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }

      const generated = await deepseekService.generateWhatsAppMessages(parsed.data.promptBase, 3, {
        tenantId: req.tenantId,
        source: 'test',
      });

      res.json({ messages: generated.messages.slice(0, 3) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[WhatsApp] testPrompt error:', message);
      res.status(500).json({ error: 'Erro ao testar prompt com IA' });
    }
  },

  /** POST /whatsapp/blast — valida, salva contatos e inicia a fila */
  async sendBlast(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId!;
      const parsed = whatsappBlastSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }

      const {
        phones,
        batchSize = 10,
        intervalMinSeconds = 15,
        intervalMaxSeconds = 60,
        messageMode = 'ai',
        promptBase,
        manualMessage,
      } = parsed.data;

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
      const safePromptBase = typeof promptBase === 'string' ? promptBase.trim() : '';
      const safeManualMessage = typeof manualMessage === 'string' ? manualMessage.trim() : '';

      if (messageMode === 'ai' && !safePromptBase) {
        res.status(400).json({ error: 'Prompt da IA é obrigatório no modo IA.' });
        return;
      }

      if (messageMode === 'manual' && !safeManualMessage) {
        res.status(400).json({ error: 'Mensagem fixa é obrigatória no modo manual.' });
        return;
      }

      const blastId = uuid();

      // Auto-save phone numbers as contacts (dedupe by phone)
      const now = new Date().toISOString();
      Promise.all(cleanPhones.map((phone) => contactsRepository.upsertWhatsappContactByPhone(tenantId, {
        phone,
        status: 'contacted',
        lastMessageAt: now,
      }))).catch((err: Error) => {
        console.error('[WhatsApp] Failed to auto-save contacts:', err.message);
      });

      await outboundRunsRepository.createWhatsAppRun(tenantId, {
        runId: blastId,
        targets: cleanPhones,
        messageMode,
        batchSize: safeBatchSize,
        intervalMinSeconds: safeMin,
        intervalMaxSeconds: safeMax,
        promptBase: messageMode === 'ai' ? safePromptBase : undefined,
        manualMessage: messageMode === 'manual' ? safeManualMessage : undefined,
      });

      await enqueueWhatsAppBlastJob({ tenantId, runId: blastId });

      res.json({ blastId, total: cleanPhones.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[WhatsApp] sendBlast error:', message);
      res.status(500).json({ error: 'Erro interno ao iniciar disparo' });
    }
  },

  /** POST /whatsapp/blast/:blastId/cancel */
  async cancelBlast(req: Request, res: Response) {
    const parsed = blastParamSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const ok = await outboundRunsRepository.requestCancel(req.tenantId!, parsed.data.blastId);
    if (!ok) return res.status(404).json({ error: 'Blast não encontrado ou já finalizado' });
    res.json({ cancelled: true });
  },

  /** GET /whatsapp/blast/:blastId/status */
  async statusBlast(req: Request, res: Response) {
    const parsed = blastParamSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const status = await outboundRunsRepository.getRun(req.tenantId!, parsed.data.blastId);
    if (!status) return res.status(404).json({ error: 'Blast não encontrado' });
    res.json({ phase: status.phase, sent: status.sent, total: status.total });
  },
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
    res.write(`event: config\ndata: ${JSON.stringify({ batchSize: snapshot.batchSize, phase: snapshot.phase })}\n\n`);

    const emitSnapshot = (current: Awaited<ReturnType<typeof outboundRunsRepository.getRunSnapshot>>) => {
      if (!current) return;
      res.write(`event: catchup\ndata: ${JSON.stringify(current.items.map((item, index) => ({
        phone: item.target,
        status: item.status === 'skipped' ? 'failed' : item.status,
        index,
        total: current.items.length,
        error: item.error,
      })))}\n\n`);

      if (current.phase === 'validating') {
        res.write('event: validating\ndata: {}\n\n');
      }

      if (current.validationError) {
        res.write(`event: validation_error\ndata: ${JSON.stringify({ error: current.validationError })}\n\n`);
      } else if (current.phase !== 'validating') {
        res.write(`event: validation_done\ndata: ${JSON.stringify({ total: current.total, eligible: current.total - current.skipped, skipped: current.skipped })}\n\n`);
      }

      if (current.currentBatch && current.totalBatches) {
        res.write(`event: batch_start\ndata: ${JSON.stringify({ batch: current.currentBatch, totalBatches: current.totalBatches, count: current.batchSize })}\n\n`);
      }

      if (current.currentMessage) {
        res.write(`event: batch_message\ndata: ${JSON.stringify({ batch: current.currentBatch || 1, message: current.currentMessage })}\n\n`);
      }
    };

    emitSnapshot(snapshot);

    const interval = setInterval(async () => {
      const current = await outboundRunsRepository.getRunSnapshot(req.tenantId!, parsed.data.blastId);
      if (!current) {
        clearInterval(interval);
        res.end();
        return;
      }

      emitSnapshot(current);

      if (current.status === 'completed' || current.status === 'failed' || current.status === 'cancelled') {
        const eventName = current.status === 'cancelled' ? 'cancelled' : 'done';
        res.write(`event: ${eventName}\ndata: ${JSON.stringify({ sent: current.sent, failed: current.failed + current.skipped, total: current.total })}\n\n`);
        clearInterval(interval);
        res.end();
      }
    }, 2000);

    res.on('close', () => clearInterval(interval));
  },
};
