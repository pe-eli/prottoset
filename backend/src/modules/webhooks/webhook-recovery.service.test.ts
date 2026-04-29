import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webhookRecoveryService } from './webhook-recovery.service';
import { webhookEventsRepository } from './webhook-events.repository';
import { enqueueWebhookEventJob } from '../../jobs/queues';

vi.mock('../../jobs/queues', () => ({
  enqueueWebhookEventJob: vi.fn(async () => {}),
}));

vi.mock('./webhook-events.repository', () => ({
  webhookEventsRepository: {
    findByProviderAndEventId: vi.fn(),
    markPendingForReplay: vi.fn(async () => true),
    listReplayCandidates: vi.fn(),
    countByProviderAndStatus: vi.fn(),
  },
}));

describe('webhookRecoveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replays a specific webhook by provider/event id', async () => {
    vi.mocked(webhookEventsRepository.findByProviderAndEventId).mockResolvedValue({
      id: 'evt-row-1',
      provider: 'stripe',
      eventId: 'stripe:evt_123',
      eventType: 'invoice.paid',
      status: 'failed',
      payload: {},
      signatureValid: true,
      receivedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      failureReason: 'temporary error',
    });

    const replayed = await webhookRecoveryService.replayByProviderEventId('stripe', 'stripe:evt_123');

    expect(replayed).toBe(true);
    expect(webhookEventsRepository.markPendingForReplay).toHaveBeenCalledWith('evt-row-1');
    expect(enqueueWebhookEventJob).toHaveBeenCalledWith({ provider: 'stripe', webhookEventId: 'evt-row-1' });
  });

  it('replays stale pending and failed events', async () => {
    vi.mocked(webhookEventsRepository.listReplayCandidates).mockResolvedValue([
      {
        id: 'evt-row-1',
        provider: 'stripe',
        eventId: 'stripe:evt_1',
        eventType: 'invoice.paid',
        status: 'pending',
        payload: {},
        signatureValid: true,
        receivedAt: new Date().toISOString(),
        processedAt: null,
        failureReason: null,
      },
      {
        id: 'evt-row-2',
        provider: 'stripe',
        eventId: 'stripe:evt_2',
        eventType: 'customer.subscription.updated',
        status: 'failed',
        payload: {},
        signatureValid: true,
        receivedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        failureReason: 'processing error',
      },
    ]);

    const result = await webhookRecoveryService.replayStale({ provider: 'stripe', limit: 50 });

    expect(result).toEqual({ replayed: 2, scanned: 2 });
    expect(enqueueWebhookEventJob).toHaveBeenCalledTimes(2);
  });
});
