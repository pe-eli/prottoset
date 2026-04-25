import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('bullmq', () => ({
  Worker: vi.fn(),
}));

vi.mock('../infrastructure/redis', () => ({
  getRedisClient: vi.fn(() => null),
}));

vi.mock('./outbound-runs.repository', () => ({
  outboundRunsRepository: {},
}));

vi.mock('../services/resend.service', () => ({
  resendService: {},
}));

vi.mock('../services/evolution.service', () => ({
  evolutionService: {},
}));

vi.mock('../modules/contacts/contacts.repository', () => ({
  contactsRepository: {},
}));

vi.mock('../modules/contacts/contact-messages.repository', () => ({
  contactMessagesRepository: {},
}));

vi.mock('../modules/whatsapp/whatsapp-instance.repository', () => ({
  waInstanceRepository: {},
}));

vi.mock('../modules/leads/leads.repository', () => ({
  leadsRepository: {},
}));

vi.mock('../modules/subscriptions/billing.service', () => ({
  billingService: {},
}));

vi.mock('../modules/ai/ai-orchestrator.service', () => ({
  aiOrchestrator: {},
}));

vi.mock('../modules/integrations/integration-vault.service', () => ({
  integrationVaultService: {},
}));

vi.mock('../modules/outbox/outbox-dispatcher.service', () => ({
  outboxDispatcherService: {
    kick: vi.fn(async () => {}),
  },
  startOutboxDispatcherLoop: vi.fn(),
}));

vi.mock('../modules/webhooks/webhook-events.repository', () => ({
  webhookEventsRepository: {
    findById: vi.fn(),
    isAlreadyProcessed: vi.fn(),
    markProcessed: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
  },
}));

vi.mock('../modules/webhooks/webhook-processor.service', () => ({
  webhookProcessorService: {
    process: vi.fn(async () => {}),
  },
}));

import { processWebhookEvent } from './workers';
import { webhookEventsRepository } from '../modules/webhooks/webhook-events.repository';
import { webhookProcessorService } from '../modules/webhooks/webhook-processor.service';

describe('workers webhook retry dedupe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks as processed and skips processing when event was already processed', async () => {
    vi.mocked(webhookEventsRepository.findById).mockResolvedValue({
      id: 'evt-row-1',
      provider: 'evolution',
      eventId: 'evolution:nonce-1',
      eventType: 'MESSAGES_UPSERT',
      status: 'pending',
      payload: { hello: 'world' },
      signatureValid: true,
      receivedAt: new Date().toISOString(),
      processedAt: null,
      failureReason: null,
    });
    vi.mocked(webhookEventsRepository.isAlreadyProcessed).mockResolvedValue(true);

    await processWebhookEvent({
      provider: 'evolution',
      webhookEventId: 'evt-row-1',
    });

    expect(webhookProcessorService.process).not.toHaveBeenCalled();
    expect(webhookEventsRepository.markProcessed).toHaveBeenCalledWith('evt-row-1');
  });
});
