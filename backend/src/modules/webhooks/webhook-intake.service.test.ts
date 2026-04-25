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
});
