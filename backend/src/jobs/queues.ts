import { JobsOptions, Queue } from 'bullmq';
import { getRedisClient } from '../infrastructure/redis';
import { NormalizedLeadInput } from '../modules/discovery/types';

export interface BlastJobPayload {
  tenantId: string;
  runId: string;
  resendFrom?: string;
}

export interface WebhookJobPayload {
  provider: 'mercadopago' | 'evolution' | 'stripe';
  webhookEventId: string;
}

export interface DiscoverySearchJobPayload {
  tenantId: string;
  searchId: string;
}

export interface InstagramExtractionJobPayload {
  tenantId: string;
  searchId: string;
  rawResultId: string;
  profileUrl: string;
}

export interface LeadNormalizationJobPayload {
  tenantId: string;
  searchId: string;
  rawResultId: string;
  normalizedProfile: NormalizedLeadInput;
  originalQuery: string;
}

let emailQueue: Queue<BlastJobPayload> | null = null;
let whatsappQueue: Queue<BlastJobPayload> | null = null;
let webhookQueue: Queue<WebhookJobPayload> | null = null;
let discoverySearchQueue: Queue<DiscoverySearchJobPayload> | null = null;
let instagramExtractionQueue: Queue<InstagramExtractionJobPayload> | null = null;
let leadNormalizationQueue: Queue<LeadNormalizationJobPayload> | null = null;

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
    // BullMQ rejects custom job IDs containing ':'. Keep a stable dedupe key without colons.
    jobId: `${payload.provider}-${payload.webhookEventId}`,
  });
}

export function getDiscoverySearchQueue(): Queue<DiscoverySearchJobPayload> {
  if (!discoverySearchQueue) {
    discoverySearchQueue = new Queue<DiscoverySearchJobPayload>('discovery-search-queue', {
      connection: requireConnection(),
      defaultJobOptions: {
        ...getDefaultOptions(),
        attempts: 5,
      },
    });
  }
  return discoverySearchQueue;
}

export function getInstagramExtractionQueue(): Queue<InstagramExtractionJobPayload> {
  if (!instagramExtractionQueue) {
    instagramExtractionQueue = new Queue<InstagramExtractionJobPayload>('instagram-extraction-queue', {
      connection: requireConnection(),
      defaultJobOptions: {
        ...getDefaultOptions(),
        attempts: 5,
      },
    });
  }
  return instagramExtractionQueue;
}

export function getLeadNormalizationQueue(): Queue<LeadNormalizationJobPayload> {
  if (!leadNormalizationQueue) {
    leadNormalizationQueue = new Queue<LeadNormalizationJobPayload>('lead-normalization-queue', {
      connection: requireConnection(),
      defaultJobOptions: {
        ...getDefaultOptions(),
        attempts: 4,
      },
    });
  }
  return leadNormalizationQueue;
}

export async function enqueueDiscoverySearchJob(payload: DiscoverySearchJobPayload): Promise<void> {
  await getDiscoverySearchQueue().add(payload.searchId, payload, {
    jobId: `${payload.tenantId}-${payload.searchId}`,
  });
}

export async function enqueueInstagramExtractionJob(payload: InstagramExtractionJobPayload): Promise<void> {
  await getInstagramExtractionQueue().add(payload.rawResultId, payload, {
    jobId: `${payload.tenantId}-${payload.rawResultId}`,
  });
}

export async function enqueueLeadNormalizationJob(payload: LeadNormalizationJobPayload): Promise<void> {
  await getLeadNormalizationQueue().add(payload.rawResultId, payload, {
    jobId: `${payload.tenantId}-${payload.rawResultId}`,
  });
}