import { Response } from 'express';
import { evolutionService } from '../../services/evolution.service';
import { deepseekService } from '../../services/deepseek.service';

export type WaJobStatus = 'pending' | 'sending' | 'sent' | 'failed';

export interface WaJob {
  phone: string;
  status: WaJobStatus;
  error?: string;
  message?: string;
}

export interface WaBlastConfig {
  batchSize: number;
  intervalMinSeconds: number;
  intervalMaxSeconds: number;
}

interface WaBlastEntry {
  jobs: WaJob[];
  promptBase: string;
  config: WaBlastConfig;
  phase: 'sending' | 'done' | 'cancelled';
  cancelled: boolean;
  subscribers: Set<Response>;
  startedAt: string;
  finishedAt?: string;
}

const blasts = new Map<string, WaBlastEntry>();

function randomDelay(minSec: number, maxSec: number): number {
  return Math.floor(Math.random() * (maxSec - minSec + 1) + minSec);
}

function emit(entry: WaBlastEntry, event: string, data: object) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of entry.subscribers) {
    try {
      res.write(payload);
    } catch {
      entry.subscribers.delete(res);
    }
  }
}

function closeAll(entry: WaBlastEntry) {
  for (const res of entry.subscribers) {
    try { res.end(); } catch { /* ignore */ }
  }
  entry.subscribers.clear();
}

async function countdownDelay(entry: WaBlastEntry, seconds: number): Promise<void> {
  for (let remaining = seconds; remaining > 0; remaining--) {
    if (entry.cancelled) return;
    emit(entry, 'tick', { remaining, total: seconds });
    await new Promise((res) => setTimeout(res, 1000));
  }
}

async function processBlast(blastId: string) {
  const entry = blasts.get(blastId);
  if (!entry) return;

  const total = entry.jobs.length;
  const { batchSize, intervalMinSeconds, intervalMaxSeconds } = entry.config;
  const totalBatches = Math.ceil(total / batchSize);
  entry.phase = 'sending';

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    if (entry.cancelled) break;

    const batchStart = batchIndex * batchSize;
    const batchJobs = entry.jobs.slice(batchStart, batchStart + batchSize);

    // ── Fase de geração: cria uma mensagem nova para este lote ──
    emit(entry, 'batch_generating', {
      batch: batchIndex + 1,
      totalBatches,
      count: batchJobs.length,
    });

    let batchMessage: string;
    try {
      batchMessage = await deepseekService.generateWhatsAppMessage(entry.promptBase);
      if (!batchMessage || batchMessage.trim() === entry.promptBase.trim()) {
        throw new Error('DeepSeek retornou o prompt sem transformação. Verifique a DEEPSEEK_API_KEY no .env');
      }
    } catch (genErr: any) {
      emit(entry, 'gen_error', { batch: batchIndex + 1, error: genErr.message ?? 'Erro na geração de mensagem' });
      // Aborta o disparo — nunca envia o prompt como mensagem
      break;
    }

    // ── Fase de envio: dispara todos os phones do lote ──
    emit(entry, 'batch_message', {
      batch: batchIndex + 1,
      message: batchMessage,
    });
    emit(entry, 'batch_start', {
      batch: batchIndex + 1,
      totalBatches,
      count: batchJobs.length,
    });

    for (let i = 0; i < batchJobs.length; i++) {
      if (entry.cancelled) break;
      const job = batchJobs[i];
      const globalIndex = batchStart + i;

      job.status = 'sending';
      job.message = batchMessage;
      emit(entry, 'progress', { phone: job.phone, status: 'sending', index: globalIndex, total });

      const result = await evolutionService.sendMessage(job.phone, batchMessage);

      if (result.success) {
        job.status = 'sent';
        emit(entry, 'progress', { phone: job.phone, status: 'sent', index: globalIndex, total });
      } else {
        job.status = 'failed';
        job.error = result.error;
        emit(entry, 'progress', {
          phone: job.phone,
          status: 'failed',
          index: globalIndex,
          total,
          error: result.error,
        });
      }

      if (i < batchJobs.length - 1) {
        const delaySec = randomDelay(intervalMinSeconds, intervalMaxSeconds);
        await countdownDelay(entry, delaySec);
      }
    }

    if (batchIndex < totalBatches - 1) {
      const delaySec = randomDelay(intervalMinSeconds, intervalMaxSeconds);
      await countdownDelay(entry, delaySec);
    }
  }

  // ── Finalizado ──
  const finalEntry = blasts.get(blastId);
  if (finalEntry) {
    finalEntry.phase = finalEntry.cancelled ? 'cancelled' : 'done';
    finalEntry.finishedAt = new Date().toISOString();
    const sent = finalEntry.jobs.filter((j) => j.status === 'sent').length;
    const failed = finalEntry.jobs.filter((j) => j.status === 'failed').length;
    const event = finalEntry.cancelled ? 'cancelled' : 'done';
    emit(finalEntry, event, { sent, failed, total });
    setTimeout(() => closeAll(finalEntry), 500);
  }
}

export const waBlastQueue = {
  create(
    blastId: string,
    phones: string[],
    promptBase: string,
    config: WaBlastConfig,
  ): WaBlastEntry {
    const jobs: WaJob[] = phones.map((phone) => ({ phone, status: 'pending' }));
    const entry: WaBlastEntry = {
      jobs,
      promptBase,
      config,
      phase: 'sending',
      cancelled: false,
      subscribers: new Set(),
      startedAt: new Date().toISOString(),
    };
    blasts.set(blastId, entry);
    processBlast(blastId).catch((err) => {
      console.error(`[WA Blast] processBlast error for ${blastId}:`, err.message);
    });
    // Auto-cleanup after 10 minutes
    setTimeout(() => blasts.delete(blastId), 10 * 60 * 1000);
    return entry;
  },

  subscribe(blastId: string, res: Response): boolean {
    const entry = blasts.get(blastId);
    if (!entry) return false;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Config para o frontend reconstruir o preview de lotes
    res.write(`event: config\ndata: ${JSON.stringify({ ...entry.config, phase: entry.phase })}\n\n`);

    // Catch-up do estado atual dos jobs
    const catchup = entry.jobs.map((j, i) => ({
      phone: j.phone,
      status: j.status,
      index: i,
      total: entry.jobs.length,
      error: j.error,
    }));
    res.write(`event: catchup\ndata: ${JSON.stringify(catchup)}\n\n`);

    if (entry.finishedAt) {
      const sent = entry.jobs.filter((j) => j.status === 'sent').length;
      const failed = entry.jobs.filter((j) => j.status === 'failed').length;
      const event = entry.cancelled ? 'cancelled' : 'done';
      res.write(
        `event: ${event}\ndata: ${JSON.stringify({ sent, failed, total: entry.jobs.length })}\n\n`,
      );
      res.end();
      return true;
    }

    entry.subscribers.add(res);
    res.on('close', () => entry.subscribers.delete(res));
    return true;
  },

  get(blastId: string): WaBlastEntry | undefined {
    return blasts.get(blastId);
  },

  cancel(blastId: string): boolean {
    const entry = blasts.get(blastId);
    if (!entry || entry.phase !== 'sending') return false;
    entry.cancelled = true;
    return true;
  },

  status(blastId: string): { phase: string; sent: number; total: number } | null {
    const entry = blasts.get(blastId);
    if (!entry) return null;
    return {
      phase: entry.phase,
      sent: entry.jobs.filter((j) => j.status === 'sent').length,
      total: entry.jobs.length,
    };
  },
};
