import { Worker } from 'bullmq';
import { getRedisClient } from '../infrastructure/redis';
import { outboundRunsRepository, OutboundRunItem } from './outbound-runs.repository';
import { resendService } from '../services/resend.service';
import { evolutionService } from '../services/evolution.service';
import { contactsRepository } from '../modules/contacts/contacts.repository';
import { contactMessagesRepository } from '../modules/contacts/contact-messages.repository';
import { waInstanceRepository } from '../modules/whatsapp/whatsapp-instance.repository';
import { leadsRepository } from '../modules/leads/leads.repository';
import { billingService } from '../modules/subscriptions/billing.service';
import type { Lead } from '../types/leads.types';
import type { BlastJobPayload, WebhookJobPayload } from './queues';
import { webhookEventsRepository } from '../modules/webhooks/webhook-events.repository';
import { webhookProcessorService } from '../modules/webhooks/webhook-processor.service';
import { aiOrchestrator } from '../modules/ai/ai-orchestrator.service';
import { integrationVaultService } from '../modules/integrations/integration-vault.service';
import { outboxDispatcherService, startOutboxDispatcherLoop } from '../modules/outbox/outbox-dispatcher.service';
import { startDowngradeCronJob } from './downgrade-cron';
import {
  buildPersonalizedPrompt,
  buildPhoneKeys,
  normalizePhone,
  parsePersonalizationFields,
  pickPainPoint,
  resolveLeadByPhone,
} from '../modules/whatsapp/personalization.utils';

let workersStarted = false;

function randomDelay(minSec: number, maxSec: number): number {
  return Math.floor(Math.random() * (maxSec - minSec + 1) + minSec);
}

async function sleepWithCancel(tenantId: string, runId: string, seconds: number): Promise<boolean> {
  for (let index = 0; index < seconds; index++) {
    if (await outboundRunsRepository.isCancelRequested(tenantId, runId)) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return true;
}

async function processEmailBlast({ tenantId, runId, resendFrom }: BlastJobPayload): Promise<void> {
  const run = await outboundRunsRepository.getRun(tenantId, runId);
  if (!run) return;

  const integration = await integrationVaultService.getSecret(tenantId, 'resend_api_key');
  const integrationFrom = typeof integration?.metadata?.resendFrom === 'string'
    ? integration.metadata.resendFrom.trim()
    : '';
  const runtimeResendFrom = (resendFrom || integrationFrom || '').trim() || undefined;
  const runtimeResendApiKey = integration?.secret;

  const items = (await outboundRunsRepository.getItems(tenantId, runId)).filter((item) => item.status === 'pending');
  if (items.length === 0) {
    await outboundRunsRepository.finalize(tenantId, runId, 'completed');
    return;
  }

  await outboundRunsRepository.markStarted(tenantId, runId, 'running');

  const totalBatches = Math.ceil(items.length / run.batchSize);
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    if (await outboundRunsRepository.isCancelRequested(tenantId, runId)) {
      await outboundRunsRepository.finalize(tenantId, runId, 'cancelled');
      return;
    }

    const batch = items.slice(batchIndex * run.batchSize, batchIndex * run.batchSize + run.batchSize);
    await outboundRunsRepository.setCurrentBatch(tenantId, runId, batchIndex + 1);

    for (let index = 0; index < batch.length; index++) {
      const item = batch[index];
      if (await outboundRunsRepository.isCancelRequested(tenantId, runId)) {
        await outboundRunsRepository.finalize(tenantId, runId, 'cancelled');
        return;
      }

      const claimed = await outboundRunsRepository.claimItemForSending(tenantId, runId, item.target);
      if (!claimed) {
        continue;
      }

      const result = await resendService.sendEmail(item.target, run.subject || '', run.body || '', {
        resendApiKey: runtimeResendApiKey,
        from: runtimeResendFrom,
      });
      await outboundRunsRepository.updateItem(
        tenantId,
        runId,
        item.target,
        result.success ? 'sent' : 'failed',
        { error: result.error },
      );

      if (result.success) {
        await billingService.consume({
          tenantId,
          type: 'EMAIL',
          amount: 1,
          idempotencyKey: `billing:email:${tenantId}:${runId}:${item.target}`,
          metadata: {
            runId,
            target: item.target,
            channel: 'email',
          },
        });
      }

      if (index < batch.length - 1) {
        const canContinue = await sleepWithCancel(tenantId, runId, randomDelay(run.intervalMinSeconds, run.intervalMaxSeconds));
        if (!canContinue) {
          await outboundRunsRepository.finalize(tenantId, runId, 'cancelled');
          return;
        }
      }
    }

    await outboundRunsRepository.refreshSummary(tenantId, runId);

    if (batchIndex < totalBatches - 1) {
      const canContinue = await sleepWithCancel(tenantId, runId, randomDelay(run.intervalMinSeconds, run.intervalMaxSeconds));
      if (!canContinue) {
        await outboundRunsRepository.finalize(tenantId, runId, 'cancelled');
        return;
      }
    }
  }

  await outboundRunsRepository.finalize(tenantId, runId, 'completed');
}

async function updateContactMessage(tenantId: string, item: OutboundRunItem): Promise<void> {
  if (!item.message) return;
  const sentAt = new Date().toISOString();
  const contact = await contactsRepository.upsertWhatsappContactByPhone(tenantId, {
    phone: item.target,
    status: 'contacted',
    lastMessage: item.message,
    lastMessageAt: sentAt,
  });

  await contactMessagesRepository.create(tenantId, {
    contactId: contact.id,
    channel: 'whatsapp',
    direction: 'outbound',
    content: item.message,
    sentAt,
    externalId: `${item.runId}:${item.target}:${item.updatedAt}`,
  });

  await contactsRepository.update(tenantId, contact.id, {
    lastMessage: item.message,
    lastMessageAt: sentAt,
  });
}

async function processWhatsAppBlast({ tenantId, runId }: BlastJobPayload): Promise<void> {
  const run = await outboundRunsRepository.getRun(tenantId, runId);
  if (!run) return;

  // Resolve per-tenant WhatsApp instance
  const waInstance = await waInstanceRepository.findByTenant(tenantId);
  if (!waInstance || waInstance.status !== 'connected') {
    await outboundRunsRepository.setFailure(tenantId, runId,
      'WhatsApp não conectado. Conecte seu WhatsApp antes de enviar.');
    return;
  }
  const { instanceName } = waInstance;

  const items = await outboundRunsRepository.getItems(tenantId, runId);
  await outboundRunsRepository.markStarted(tenantId, runId, 'validating');

  try {
    const [validationResult, existingChats] = await Promise.all([
      evolutionService.checkNumbers(instanceName, items.map((item) => item.target)),
      evolutionService.fetchExistingChats(instanceName),
    ]);

    const validSet = new Set(Array.from(validationResult.valid, normalizePhone));
    const invalidTargets: string[] = [];
    const existingTargets: string[] = [];

    for (const item of items) {
      const keys = buildPhoneKeys(item.target);
      const isValid = keys.some((key) => validSet.has(key));
      const hasExistingChat = keys.some((key) => existingChats.has(key));

      if (!isValid) {
        invalidTargets.push(item.target);
      } else if (hasExistingChat) {
        existingTargets.push(item.target);
      }
    }

    await outboundRunsRepository.markMany(tenantId, runId, invalidTargets, 'skipped', 'Número não tem WhatsApp');
    await outboundRunsRepository.markMany(tenantId, runId, existingTargets, 'skipped', 'Conversa já existe');
    await outboundRunsRepository.refreshSummary(tenantId, runId);
    await outboundRunsRepository.setPhase(tenantId, runId, 'running');
  } catch (err: any) {
    // If 401/404, instance may have disconnected
    if (err.message?.includes('401') || err.message?.includes('404')) {
      await waInstanceRepository.updateStatus(instanceName, 'disconnected');
    }
    await outboundRunsRepository.setValidationError(tenantId, runId, err.message || 'Erro ao validar números');
    return;
  }

  const eligibleItems = (await outboundRunsRepository.getItems(tenantId, runId)).filter((item) => item.status === 'pending');
  if (eligibleItems.length === 0) {
    await outboundRunsRepository.finalize(tenantId, runId, 'completed');
    return;
  }

  const messageMode = run.messageMode === 'manual' ? 'manual' : 'ai';
  const manualMessage = (run.manualMessage || '').trim();
  const personalizationEnabled = messageMode === 'ai' && Boolean(run.personalizationEnabled);
  const personalizationFields = parsePersonalizationFields(run.personalizationFields || []);
  const painPoints = (run.painPoints || []).map((item) => item.trim()).filter(Boolean);

  if (messageMode === 'manual' && !manualMessage) {
    await outboundRunsRepository.setFailure(tenantId, runId, 'Mensagem manual inválida para disparo.');
    return;
  }

  const leadMap = personalizationEnabled
    ? await leadsRepository.getByNormalizedPhones(tenantId, eligibleItems.map((item) => item.target))
    : new Map<string, Lead>();

  const totalBatches = Math.ceil(eligibleItems.length / run.batchSize);
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    if (await outboundRunsRepository.isCancelRequested(tenantId, runId)) {
      await outboundRunsRepository.finalize(tenantId, runId, 'cancelled');
      return;
    }

    const batch = eligibleItems.slice(batchIndex * run.batchSize, batchIndex * run.batchSize + run.batchSize);

    await outboundRunsRepository.setCurrentBatch(tenantId, runId, batchIndex + 1);

    for (let index = 0; index < batch.length; index++) {
      const item = batch[index];
      let messageForItem = manualMessage;
      if (await outboundRunsRepository.isCancelRequested(tenantId, runId)) {
        await outboundRunsRepository.finalize(tenantId, runId, 'cancelled');
        return;
      }

      const claimed = await outboundRunsRepository.claimItemForSending(tenantId, runId, item.target);
      if (!claimed) {
        continue;
      }

      if (messageMode === 'ai') {
        const lead = personalizationEnabled ? resolveLeadByPhone(item.target, leadMap) : null;
        const painPoint = personalizationEnabled && personalizationFields.includes('pain_points')
          ? pickPainPoint(painPoints, batchIndex, index)
          : null;
        const promptForItem = personalizationEnabled
          ? buildPersonalizedPrompt({
            basePrompt: run.promptBase || '',
            fields: personalizationFields,
            lead,
            painPoint,
          })
          : (run.promptBase || '');

        try {
          const result = await aiOrchestrator.generate({
            tenantId,
            prompt: promptForItem,
            source: 'blast',
            idempotencyKey: `ai:${tenantId}:${runId}:batch:${batchIndex + 1}:item:${item.id}`,
            metadata: {
              runId,
              itemId: item.id,
              batch: batchIndex + 1,
            },
          });
          messageForItem = result.message;
        } catch (err: any) {
          await outboundRunsRepository.updateItem(tenantId, runId, item.target, 'failed', {
            error: err.message || 'Erro ao gerar mensagem',
          });
          await outboundRunsRepository.setFailure(tenantId, runId, err.message || 'Erro ao gerar mensagem');
          return;
        }

        await outboundRunsRepository.setCurrentBatch(tenantId, runId, batchIndex + 1, messageForItem);
      }

      await outboundRunsRepository.updateItem(tenantId, runId, item.target, 'sending', { message: messageForItem });
      const result = await evolutionService.sendMessage(instanceName, item.target, messageForItem);
      await outboundRunsRepository.updateItem(
        tenantId,
        runId,
        item.target,
        result.success ? 'sent' : 'failed',
        { error: result.error, message: messageForItem },
      );

      if (result.success) {
        await billingService.consume({
          tenantId,
          type: 'WHATSAPP',
          amount: 1,
          idempotencyKey: `billing:whatsapp:${tenantId}:${runId}:${item.target}`,
          metadata: {
            runId,
            target: item.target,
            channel: 'whatsapp',
          },
        });
      }

      if (result.success) {
        await updateContactMessage(tenantId, { ...item, message: messageForItem, status: 'sent', updatedAt: new Date().toISOString() });
      } else if (result.error?.includes('401')) {
        // Instance disconnected mid-blast
        await waInstanceRepository.updateStatus(instanceName, 'disconnected');
        await outboundRunsRepository.setFailure(tenantId, runId, 'WhatsApp desconectou durante o envio');
        return;
      }

      if (index < batch.length - 1) {
        const canContinue = await sleepWithCancel(tenantId, runId, randomDelay(run.intervalMinSeconds, run.intervalMaxSeconds));
        if (!canContinue) {
          await outboundRunsRepository.finalize(tenantId, runId, 'cancelled');
          return;
        }
      }
    }

    await outboundRunsRepository.refreshSummary(tenantId, runId);

    if (batchIndex < totalBatches - 1) {
      const canContinue = await sleepWithCancel(tenantId, runId, randomDelay(run.intervalMinSeconds, run.intervalMaxSeconds));
      if (!canContinue) {
        await outboundRunsRepository.finalize(tenantId, runId, 'cancelled');
        return;
      }
    }
  }

  await outboundRunsRepository.finalize(tenantId, runId, 'completed');
}

export async function processWebhookEvent(payload: WebhookJobPayload): Promise<void> {
  const event = await webhookEventsRepository.findById(payload.webhookEventId);
  if (!event) {
    return;
  }

  if (event.status === 'processed') {
    return;
  }

  if (await webhookEventsRepository.isAlreadyProcessed(event.provider, event.eventId)) {
    await webhookEventsRepository.markProcessed(event.id);
    return;
  }

  try {
    await webhookProcessorService.process(payload.provider, event.payload);
    await webhookEventsRepository.markProcessed(event.id);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido no processamento de webhook';
    await webhookEventsRepository.markFailed(event.id, message);
    throw err;
  }
}

export function startBackgroundWorkers(): void {
  if (workersStarted) return;
  const connection = getRedisClient();
  if (!connection) {
    console.warn('[Jobs] REDIS_URL não configurada. Blasts persistentes ficarão indisponíveis.');
    return;
  }

  workersStarted = true;
  startOutboxDispatcherLoop();
  void outboxDispatcherService.kick(100);
  startDowngradeCronJob();

  new Worker<BlastJobPayload>('email-blasts', async (job) => {
    if (job.attemptsMade > 0) {
      await outboundRunsRepository.setPhase(job.data.tenantId, job.data.runId, 'retrying');
    }
    await processEmailBlast(job.data);
  }, { connection, concurrency: 3 });

  new Worker<BlastJobPayload>('whatsapp-blasts', async (job) => {
    if (job.attemptsMade > 0) {
      await outboundRunsRepository.setPhase(job.data.tenantId, job.data.runId, 'retrying');
    }
    await processWhatsAppBlast(job.data);
  }, { connection, concurrency: 2 });

  new Worker<WebhookJobPayload>('webhook-events', async (job) => {
    await processWebhookEvent(job.data);
  }, { connection, concurrency: 8 });
}