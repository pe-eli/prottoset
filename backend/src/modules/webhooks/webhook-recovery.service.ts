import { enqueueWebhookEventJob } from '../../jobs/queues';
import { webhookEventsRepository, type WebhookProvider, type WebhookEventStatus } from './webhook-events.repository';

function toProvider(value: string): WebhookProvider {
  if (value === 'stripe' || value === 'mercadopago' || value === 'evolution') {
    return value;
  }
  throw new Error('Provider de webhook inválido');
}

export const webhookRecoveryService = {
  parseProvider(value: string): WebhookProvider {
    return toProvider(value);
  },

  async replayByProviderEventId(provider: WebhookProvider, eventId: string): Promise<boolean> {
    const event = await webhookEventsRepository.findByProviderAndEventId(provider, eventId);
    if (!event) return false;

    await webhookEventsRepository.markPendingForReplay(event.id);
    await enqueueWebhookEventJob({ provider: event.provider, webhookEventId: event.id });
    return true;
  },

  async replayStale(params?: {
    provider?: WebhookProvider;
    olderThanMinutes?: number;
    statuses?: WebhookEventStatus[];
    limit?: number;
  }): Promise<{ replayed: number; scanned: number }> {
    const candidates = await webhookEventsRepository.listReplayCandidates({
      provider: params?.provider,
      olderThanMinutes: params?.olderThanMinutes,
      statuses: params?.statuses,
      limit: params?.limit,
    });

    let replayed = 0;
    for (const event of candidates) {
      await webhookEventsRepository.markPendingForReplay(event.id);
      await enqueueWebhookEventJob({ provider: event.provider, webhookEventId: event.id });
      replayed += 1;
    }

    return { replayed, scanned: candidates.length };
  },

  async getHealth(provider?: WebhookProvider): Promise<{
    provider: WebhookProvider | 'all';
    counts: Array<{ provider: WebhookProvider; status: string; total: number }>;
    backlog: { pending: number; failed: number };
    healthy: boolean;
  }> {
    const counts = await webhookEventsRepository.countByProviderAndStatus(provider);

    const pending = counts
      .filter((entry) => entry.status === 'pending')
      .reduce((acc, entry) => acc + entry.total, 0);
    const failed = counts
      .filter((entry) => entry.status === 'failed')
      .reduce((acc, entry) => acc + entry.total, 0);

    return {
      provider: provider ?? 'all',
      counts,
      backlog: { pending, failed },
      healthy: pending < 50 && failed < 10,
    };
  },
};
