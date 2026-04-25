import { enqueueEmailBlastJob, enqueueWhatsAppBlastJob } from '../../jobs/queues';
import { metricsService } from '../../observability/metrics.service';
import { structuredLogger } from '../../observability/structured-logger';
import { outboxRepository, type OutboxEvent } from './outbox.repository';

let kickPromise: Promise<void> | null = null;
let loopStarted = false;

async function dispatchEvent(event: OutboxEvent): Promise<void> {
  if (event.topic === 'blast.email') {
    const runId = typeof event.payload.runId === 'string' ? event.payload.runId : '';
    const tenantId = typeof event.payload.tenantId === 'string' ? event.payload.tenantId : '';
    const resendFrom = typeof event.payload.resendFrom === 'string' ? event.payload.resendFrom : undefined;

    if (!tenantId || !runId) {
      throw new Error('Outbox blast.email com payload invalido');
    }

    await enqueueEmailBlastJob({ tenantId, runId, resendFrom });
    return;
  }

  if (event.topic === 'blast.whatsapp') {
    const runId = typeof event.payload.runId === 'string' ? event.payload.runId : '';
    const tenantId = typeof event.payload.tenantId === 'string' ? event.payload.tenantId : '';

    if (!tenantId || !runId) {
      throw new Error('Outbox blast.whatsapp com payload invalido');
    }

    await enqueueWhatsAppBlastJob({ tenantId, runId });
    return;
  }

  throw new Error(`Topico de outbox nao suportado: ${event.topic}`);
}

export const outboxDispatcherService = {
  async processPending(limit = 20): Promise<void> {
    const events = await outboxRepository.claimPending(limit);

    for (const event of events) {
      try {
        await dispatchEvent(event);
        await outboxRepository.markDispatched(event.id);

        metricsService.increment({
          name: 'outbox.dispatch.success',
          labels: { topic: event.topic },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown_outbox_dispatch_error';
        const retryInSeconds = Math.min(300, Math.max(10, event.attempts * 10));
        await outboxRepository.markFailed(event.id, message, retryInSeconds);

        structuredLogger.warn('outbox_dispatch_failed', {
          outboxEventId: event.id,
          topic: event.topic,
          attempts: event.attempts,
          retryInSeconds,
          error: message,
        });

        metricsService.increment({
          name: 'outbox.dispatch.failed',
          labels: { topic: event.topic },
        });
      }
    }
  },

  async kick(limit = 20): Promise<void> {
    if (kickPromise) {
      return kickPromise;
    }

    kickPromise = this.processPending(limit)
      .catch((err) => {
        structuredLogger.error('outbox_kick_failed', {
          error: err instanceof Error ? err.message : 'unknown_error',
        });
      })
      .finally(() => {
        kickPromise = null;
      });

    return kickPromise;
  },
};

export function startOutboxDispatcherLoop(): void {
  if (loopStarted) return;
  loopStarted = true;

  setInterval(() => {
    void outboxDispatcherService.kick(50);
  }, 2_000);
}
