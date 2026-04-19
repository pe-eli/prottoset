import { enqueueWebhookEventJob } from '../../jobs/queues';
import crypto from 'crypto';
import { fraudService } from '../../security/fraud.service';
import { webhookEventsRepository, type WebhookProvider } from './webhook-events.repository';
import { webhookSecurityService } from './webhook-security.service';

class WebhookAuthError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseJsonPayload(rawBody: Buffer | string): Record<string, unknown> {
  const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Webhook payload must be a JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new WebhookAuthError('Payload inválido', 400);
  }
}

function getMercadoPagoEventId(payload: Record<string, unknown>): string | null {
  const directId = payload.id;
  if (typeof directId === 'string' && directId.length > 0) {
    return `mp:${directId}`;
  }

  const data = payload.data as Record<string, unknown> | undefined;
  const dataId = data?.id;
  if (typeof dataId === 'string' && dataId.length > 0) {
    const type = typeof payload.type === 'string' ? payload.type : 'unknown';
    const action = typeof payload.action === 'string' ? payload.action : 'unknown';
    return `mp:${type}:${action}:${dataId}`;
  }

  return null;
}

function getMercadoPagoEventType(payload: Record<string, unknown>): string {
  const type = typeof payload.type === 'string' ? payload.type : 'unknown';
  const action = typeof payload.action === 'string' ? payload.action : 'unknown';
  return `${type}:${action}`;
}

function isIpAllowed(ip: string, allowed: string[]): boolean {
  const normalizedIp = ip.trim();
  return allowed.some((entry) => entry.trim() === normalizedIp);
}

export const webhookIntakeService = {
  async intakeMercadoPago(params: {
    rawBody: Buffer | string;
    signatureHeader?: string;
    sourceIp: string;
  }): Promise<{ accepted: boolean; duplicate: boolean; webhookEventId: string }> {
    const payload = parseJsonPayload(params.rawBody);
    const eventId = getMercadoPagoEventId(payload);
    if (!eventId) {
      throw new WebhookAuthError('Webhook sem event_id', 400);
    }

    const validation = webhookSecurityService.validateMercadoPagoSignature({
      rawBody: params.rawBody,
      signatureHeader: params.signatureHeader,
      secret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
    });

    if (!validation.valid) {
      await fraudService.recordEvent({
        eventType: 'webhook_invalid_signature',
        severity: 'high',
        details: {
          provider: 'mercadopago',
          sourceIp: params.sourceIp,
          reason: validation.reason,
          eventId,
        },
      });
      await fraudService.detectInvalidWebhookBurst('mercadopago');
      throw new WebhookAuthError('Assinatura de webhook inválida', 401);
    }

    const { created, event } = await webhookEventsRepository.createPending({
      provider: 'mercadopago',
      eventId,
      eventType: getMercadoPagoEventType(payload),
      payload,
      signatureValid: true,
    });

    if (created) {
      await enqueueWebhookEventJob({ provider: 'mercadopago', webhookEventId: event.id });
    }

    return { accepted: true, duplicate: !created, webhookEventId: event.id };
  },

  async intakeEvolution(params: {
    rawBody: Buffer | string;
    signatureHeader?: string;
    timestampHeader?: string;
    nonceHeader?: string;
    sourceIp: string;
    tokenValidated?: boolean;
  }): Promise<{ accepted: boolean; duplicate: boolean; webhookEventId: string }> {
    const allowListRaw = process.env.EVOLUTION_WEBHOOK_ALLOWED_IPS?.trim();
    if (allowListRaw) {
      const allowed = allowListRaw.split(',').map((entry) => entry.trim()).filter(Boolean);
      if (allowed.length > 0 && !isIpAllowed(params.sourceIp, allowed)) {
        await fraudService.recordEvent({
          eventType: 'webhook_ip_not_allowed',
          severity: 'high',
          details: { provider: 'evolution', sourceIp: params.sourceIp },
        });
        throw new WebhookAuthError('IP não permitida para webhook', 403);
      }
    }

    const payload = parseJsonPayload(params.rawBody);
    const eventType = typeof payload.event === 'string' ? payload.event : 'unknown';

    let eventId: string;
    if (params.tokenValidated) {
      const raw = Buffer.isBuffer(params.rawBody) ? params.rawBody : Buffer.from(params.rawBody);
      const digest = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
      eventId = `evolution:token:${digest}`;
    } else {
      const validation = webhookSecurityService.validateEvolutionSignature({
        rawBody: params.rawBody,
        signatureHeader: params.signatureHeader,
        timestampHeader: params.timestampHeader,
        nonceHeader: params.nonceHeader,
        secret: process.env.EVOLUTION_WEBHOOK_SECRET,
      });

      if (!validation.valid || !validation.nonce) {
        await fraudService.recordEvent({
          eventType: 'webhook_invalid_signature',
          severity: 'high',
          details: {
            provider: 'evolution',
            sourceIp: params.sourceIp,
            reason: validation.reason,
          },
        });
        await fraudService.detectInvalidWebhookBurst('evolution');
        throw new WebhookAuthError('Assinatura de webhook inválida', 401);
      }

      const nonceStored = await webhookEventsRepository.reserveNonce('evolution', validation.nonce, 10 * 60);
      if (!nonceStored) {
        await fraudService.recordEvent({
          eventType: 'webhook_replay_detected',
          severity: 'high',
          details: { provider: 'evolution', nonce: validation.nonce, sourceIp: params.sourceIp },
        });
        throw new WebhookAuthError('Webhook replay detectado', 409);
      }

      eventId = `evolution:${validation.nonce}`;
    }

    const { created, event } = await webhookEventsRepository.createPending({
      provider: 'evolution',
      eventId,
      eventType,
      payload,
      signatureValid: true,
    });

    if (created) {
      await enqueueWebhookEventJob({ provider: 'evolution', webhookEventId: event.id });
    }

    return { accepted: true, duplicate: !created, webhookEventId: event.id };
  },

  toHttpError(err: unknown): { statusCode: number; message: string } {
    if (err instanceof WebhookAuthError) {
      return { statusCode: err.statusCode, message: err.message };
    }
    if (err instanceof Error) {
      return { statusCode: 500, message: err.message };
    }
    return { statusCode: 500, message: 'Erro interno' };
  },

  getProviderFromValue(value: string): WebhookProvider {
    if (value === 'mercadopago' || value === 'evolution') {
      return value;
    }
    throw new Error('Provider de webhook inválido');
  },
};
