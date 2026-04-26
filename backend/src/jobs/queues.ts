import { JobsOptions, Queue } from 'bullmq';
import { getRedisClient } from '../infrastructure/redis';

export interface BlastJobPayload {
  tenantId: string;
  runId: string;
  resendFrom?: string;
}

export interface WebhookJobPayload {
  provider: 'mercadopago' | 'evolution' | 'stripe';
  webhookEventId: string;
}

let emailQueue: Queue<BlastJobPayload> | null = null;
let whatsappQueue: Queue<BlastJobPayload> | null = null;
let webhookQueue: Queue<WebhookJobPayload> | null = null;

function requireConnection() {
  const connection = getRedisClient();
  if (!connection) {
    throw new Error('REDIS_URL não configurada para filas persistentes');
  }
  return connection;
}

function getDefaultOptions(): JobsOptions {
  return {
    removeOnComplete: 200,
    removeOnFail: 500,
    attempts: 4,
    backoff: { type: 'exponential', delay: 5000 },
  };
}

export function getEmailBlastQueue(): Queue<BlastJobPayload> {
  if (!emailQueue) {
    emailQueue = new Queue<BlastJobPayload>('email-blasts', { connection: requireConnection(), defaultJobOptions: getDefaultOptions() });
  }
  return emailQueue;
}

export function getWhatsAppBlastQueue(): Queue<BlastJobPayload> {
  if (!whatsappQueue) {
    whatsappQueue = new Queue<BlastJobPayload>('whatsapp-blasts', { connection: requireConnection(), defaultJobOptions: getDefaultOptions() });
  }
  return whatsappQueue;
}

export function getWebhookQueue(): Queue<WebhookJobPayload> {
  if (!webhookQueue) {
    webhookQueue = new Queue<WebhookJobPayload>('webhook-events', {
      connection: requireConnection(),
      defaultJobOptions: {
        ...getDefaultOptions(),
        attempts: 8,
      },
    });
  }
  return webhookQueue;
}

export async function enqueueEmailBlastJob(payload: BlastJobPayload): Promise<void> {
  await getEmailBlastQueue().add(payload.runId, payload, { jobId: payload.runId });
}

export async function enqueueWhatsAppBlastJob(payload: BlastJobPayload): Promise<void> {
  await getWhatsAppBlastQueue().add(payload.runId, payload, { jobId: payload.runId });
}

export async function enqueueWebhookEventJob(payload: WebhookJobPayload): Promise<void> {
  await getWebhookQueue().add(payload.webhookEventId, payload, {
    jobId: `${payload.provider}:${payload.webhookEventId}`,
  });
}