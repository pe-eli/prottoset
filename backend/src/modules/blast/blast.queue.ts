import { Response } from 'express';
import { resendService } from '../../services/resend.service';

export type JobStatus = 'pending' | 'sending' | 'sent' | 'failed';

export interface BlastJob {
  email: string;
  status: JobStatus;
  error?: string;
}

export interface BlastConfig {
  batchSize: number;
  intervalMinSeconds: number;
  intervalMaxSeconds: number;
}

interface BlastEntry {
  jobs: BlastJob[];
  subject: string;
  body: string;
  config: BlastConfig;
  subscribers: Set<Response>;
  startedAt: string;
  finishedAt?: string;
}

// In-memory store: blastId → BlastEntry
const blasts = new Map<string, BlastEntry>();

function randomDelay(minSec: number, maxSec: number): number {
  return Math.floor(Math.random() * (maxSec - minSec + 1) + minSec);
}

/** Aguarda N segundos emitindo `tick` a cada segundo com { remaining, total } */
async function countdownDelay(entry: BlastEntry, seconds: number): Promise<void> {
  for (let remaining = seconds; remaining > 0; remaining--) {
    emit(entry, 'tick', { remaining, total: seconds });
    await new Promise((res) => setTimeout(res, 1000));
  }
}

function emit(entry: BlastEntry, event: string, data: object) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of entry.subscribers) {
    try {
      res.write(payload);
    } catch {
      entry.subscribers.delete(res);
    }
  }
}

function closeAll(entry: BlastEntry) {
  for (const res of entry.subscribers) {
    try { res.end(); } catch { /* ignore */ }
  }
  entry.subscribers.clear();
}

async function processBlast(blastId: string) {
  const entry = blasts.get(blastId);
  if (!entry) return;

  const { batchSize, intervalMinSeconds, intervalMaxSeconds } = entry.config;
  const jobs = entry.jobs;
  const total = jobs.length;
  const totalBatches = Math.ceil(total / batchSize);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * batchSize;
    const batchJobs = jobs.slice(batchStart, batchStart + batchSize);

    // Avisa o frontend que o lote começou
    emit(entry, 'batch_start', {
      batch: batchIndex + 1,
      totalBatches,
      count: batchJobs.length,
    });

    // Envia cada email do lote
    for (let i = 0; i < batchJobs.length; i++) {
      const job = batchJobs[i];
      const globalIndex = batchStart + i;

      job.status = 'sending';
      emit(entry, 'progress', { email: job.email, status: 'sending', index: globalIndex, total });

      const result = await resendService.sendEmail(job.email, entry.subject, entry.body);

      if (result.success) {
        job.status = 'sent';
        emit(entry, 'progress', { email: job.email, status: 'sent', index: globalIndex, total });
      } else {
        job.status = 'failed';
        job.error = result.error;
        emit(entry, 'progress', { email: job.email, status: 'failed', index: globalIndex, total, error: result.error });
      }

      // Delay aleatório entre envios dentro do lote (exceto no último)
      if (i < batchJobs.length - 1) {
        const delaySec = randomDelay(intervalMinSeconds, intervalMaxSeconds);
        await countdownDelay(entry, delaySec);
      }
    }

    // Countdown entre lotes (exceto após o último)
    if (batchIndex < totalBatches - 1) {
      const delaySec = randomDelay(intervalMinSeconds, intervalMaxSeconds);
      await countdownDelay(entry, delaySec);
    }
  }

  // Finalizado
  const finalEntry = blasts.get(blastId);
  if (finalEntry) {
    finalEntry.finishedAt = new Date().toISOString();
    const sent = finalEntry.jobs.filter((j) => j.status === 'sent').length;
    const failed = finalEntry.jobs.filter((j) => j.status === 'failed').length;
    emit(finalEntry, 'done', { sent, failed, total });
    setTimeout(() => closeAll(finalEntry), 500);
  }
}

export const blastQueue = {
  create(blastId: string, emails: string[], subject: string, body: string, config: BlastConfig): BlastEntry {
    const jobs: BlastJob[] = emails.map((email) => ({ email, status: 'pending' }));
    const entry: BlastEntry = {
      jobs,
      subject,
      body,
      config,
      subscribers: new Set(),
      startedAt: new Date().toISOString(),
    };
    blasts.set(blastId, entry);
    processBlast(blastId).catch((err) => {
      console.error(`[Blast] processBlast error for ${blastId}:`, err.message);
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

    // Catch-up com estado atual de todos os jobs
    const catchup = entry.jobs.map((j, i) => ({
      email: j.email,
      status: j.status,
      index: i,
      total: entry.jobs.length,
      error: j.error,
    }));
    res.write(`event: catchup\ndata: ${JSON.stringify(catchup)}\n\n`);

    // Config para o frontend montar o preview
    res.write(`event: config\ndata: ${JSON.stringify(entry.config)}\n\n`);

    if (entry.finishedAt) {
      const sent = entry.jobs.filter((j) => j.status === 'sent').length;
      const failed = entry.jobs.filter((j) => j.status === 'failed').length;
      res.write(`event: done\ndata: ${JSON.stringify({ sent, failed, total: entry.jobs.length })}\n\n`);
      res.end();
      return true;
    }

    entry.subscribers.add(res);
    res.on('close', () => entry.subscribers.delete(res));
    return true;
  },

  get(blastId: string): BlastEntry | undefined {
    return blasts.get(blastId);
  },
};
