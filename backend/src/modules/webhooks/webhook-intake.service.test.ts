import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueueWebhookEventJob } from '../../jobs/queues';
import { fraudService } from '../../security/fraud.service';
import { webhookEventsRepository } from './webhook-events.repository';
import { webhookIntakeService } from './webhook-intake.service';
import { webhookSecurityService } from './webhook-security.service';

vi.mock('../../jobs/queues', () => ({
  enqueueWebhookEventJob: vi.fn(),
}));

vi.mock('../../security/fraud.service', () => ({
  fraudService: {
    recordEvent: vi.fn(async () => {}),
    detectInvalidWebhookBurst: vi.fn(async () => {}),
  },
}));

vi.mock('./webhook-events.repository', () => ({
  webhookEventsRepository: {
    reserveNonce: vi.fn(),
    createPending: vi.fn(),
    findById: vi.fn(),
    markPendingForReplay: vi.fn(),
  },
}));

vi.mock('./webhook-security.service', () => ({
  webhookSecurityService: {
    validateEvolutionSignature: vi.fn(),
    validateMercadoPagoSignature: vi.fn(),
  },
}));

describe('webhookIntakeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.EVOLUTION_WEBHOOK_ALLOWED_IPS;

    vi.mocked(webhookEventsRepository.findById).mockResolvedValue({
      id: 'evt-row-1',
      provider: 'evolution',
      eventId: 'evolution:nonce-abc',
      eventType: 'messages.upsert',
      status: 'pending',
      payload: {},
      signatureValid: true,
      receivedAt: new Date().toISOString(),
      processedAt: null,
      failureReason: null,
    });
    vi.mocked(webhookEventsRepository.markPendingForReplay).mockResolvedValue(true);
  });

  it('fails closed when Evolution signature validation fails', async () => {
    vi.mocked(webhookSecurityService.validateEvolutionSignature).mockReturnValue({
      valid: false,
      reason: 'missing_webhook_secret',
    });

    await expect(
      webhookIntakeService.intakeEvolution({
        rawBody: '{}',
        sourceIp: '10.10.10.10',
      }),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(fraudService.recordEvent).toHaveBeenCalledTimes(1);
    expect(webhookEventsRepository.reserveNonce).not.toHaveBeenCalled();
    expect(enqueueWebhookEventJob).not.toHaveBeenCalled();
  });

  it('rejects replayed Evolution nonce', async () => {
    vi.mocked(webhookSecurityService.validateEvolutionSignature).mockReturnValue({
      valid: true,
      nonce: 'nonce-abc',
      timestamp: Date.now(),
    });
    vi.mocked(webhookEventsRepository.reserveNonce).mockResolvedValue(false);

    await expect(
      webhookIntakeService.intakeEvolution({
        rawBody: JSON.stringify({ event: 'MESSAGES_UPSERT' }),
        signatureHeader: 'sig',
        timestampHeader: `${Date.now()}`,
        nonceHeader: 'nonce-abc',
        sourceIp: '10.10.10.10',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(webhookEventsRepository.createPending).not.toHaveBeenCalled();
    expect(enqueueWebhookEventJob).not.toHaveBeenCalled();
  });

  it('re-enqueues duplicate pending events to recover from previous queue failures', async () => {
    vi.mocked(webhookSecurityService.validateEvolutionSignature).mockReturnValue({
      valid: true,
      nonce: 'nonce-def',
      timestamp: Date.now(),
    });
    vi.mocked(webhookEventsRepository.reserveNonce).mockResolvedValue(true);
    vi.mocked(webhookEventsRepository.createPending).mockResolvedValue({
      created: false,
      event: {
        id: 'evt-row-2',
        provider: 'evolution',
        eventId: 'evolution:nonce-def',
        eventType: 'messages.upsert',
        status: 'pending',
        payload: {},
        signatureValid: true,
        receivedAt: new Date().toISOString(),
        processedAt: null,
        failureReason: null,
      },
    });
    vi.mocked(webhookEventsRepository.findById).mockResolvedValue({
      id: 'evt-row-2',
      provider: 'evolution',
      eventId: 'evolution:nonce-def',
      eventType: 'messages.upsert',
      status: 'pending',
      payload: {},
      signatureValid: true,
      receivedAt: new Date().toISOString(),
      processedAt: null,
      failureReason: null,
    });

    const result = await webhookIntakeService.intakeEvolution({
      rawBody: JSON.stringify({ event: 'MESSAGES_UPSERT' }),
      signatureHeader: 'sig',
      timestampHeader: `${Date.now()}`,
      nonceHeader: 'nonce-def',
      sourceIp: '10.10.10.10',
    });

    expect(result.duplicate).toBe(true);
    expect(webhookEventsRepository.markPendingForReplay).toHaveBeenCalledWith('evt-row-2');
    expect(enqueueWebhookEventJob).toHaveBeenCalledWith({ provider: 'evolution', webhookEventId: 'evt-row-2' });
  });
});
