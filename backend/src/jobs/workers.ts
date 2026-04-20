import { Worker } from 'bullmq';
import { getRedisClient } from '../infrastructure/redis';
import { outboundRunsRepository, OutboundRunItem } from './outbound-runs.repository';
import { resendService } from '../services/resend.service';
import { deepseekService } from '../services/deepseek.service';
import { evolutionService } from '../services/evolution.service';
import { contactsRepository } from '../modules/contacts/contacts.repository';
import { contactMessagesRepository } from '../modules/contacts/contact-messages.repository';
import { waInstanceRepository } from '../modules/whatsapp/whatsapp-instance.repository';
import { subscriptionService } from '../modules/subscriptions/subscription.service';
import { billingService } from '../modules/subscriptions/billing.service';
import { calculateCreditsFromTokens, calculateCreditsFromChars } from '../modules/subscriptions/ai-credits';
import type { WebhookJobPayload } from './queues';
import { webhookEventsRepository } from '../modules/webhooks/webhook-events.repository';
import { webhookProcessorService } from '../modules/webhooks/webhook-processor.service';

interface BlastJobPayload {
  tenantId: string;
  runId: string;
  resendApiKey?: string;
  resendFrom?: string;
}

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

async function processEmailBlast({ tenantId, runId, resendApiKey, resendFrom }: BlastJobPayload): Promise<void> {
  const run = await outboundRunsRepository.getRun(tenantId, runId);
  if (!run) return;

  const items = await outboundRunsRepository.getItems(tenantId, runId);
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

      await outboundRunsRepository.updateItem(tenantId, runId, item.target, 'sending');
      const result = await resendService.sendEmail(item.target, run.subject || '', run.body || '', {
        resendApiKey,
        from: resendFrom,
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

      await outboundRunsRepository.refreshSummary(tenantId, runId);

      if (index < batch.length - 1) {
        const canContinue = await sleepWithCancel(tenantId, runId, randomDelay(run.intervalMinSeconds, run.intervalMaxSeconds));
        if (!canContinue) {
          await outboundRunsRepository.finalize(tenantId, runId, 'cancelled');
          return;
        }
      }
    }

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

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function buildPhoneKeys(value: string): string[] {
  const normalized = normalizePhone(value);
  return normalized.startsWith('55') && normalized.length > 11 ? [normalized, normalized.slice(2)] : [normalized];
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

  if (messageMode === 'manual' && !manualMessage) {
    await outboundRunsRepository.setFailure(tenantId, runId, 'Mensagem manual inválida para disparo.');
    return;
  }

  if (messageMode === 'ai') {
    // Pre-flight: verify AI credits before starting generation
    const creditCheck = await subscriptionService.checkLimit(tenantId, 'ai_credits');
    if (!creditCheck.allowed) {
      await outboundRunsRepository.setFailure(tenantId, runId,
        'Créditos de IA insuficientes para iniciar o disparo.');
      return;
    }
  }

  const totalBatches = Math.ceil(eligibleItems.length / run.batchSize);
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    if (await outboundRunsRepository.isCancelRequested(tenantId, runId)) {
      await outboundRunsRepository.finalize(tenantId, runId, 'cancelled');
      return;
    }

    const batch = eligibleItems.slice(batchIndex * run.batchSize, batchIndex * run.batchSize + run.batchSize);

    let batchMessage = '';
    if (messageMode === 'ai') {
      // Check credits before each DeepSeek call (prevents over-spend during long blasts)
      const batchCreditCheck = await subscriptionService.checkLimit(tenantId, 'ai_credits');
      if (!batchCreditCheck.allowed) {
        await outboundRunsRepository.setFailure(tenantId, runId,
          'Créditos de IA insuficientes para continuar o disparo.');
        return;
      }

      let creditsUsed = 0;
      try {
        const result = await deepseekService.generateWhatsAppMessage(run.promptBase, {
          tenantId,
          source: 'blast',
        });
        batchMessage = result.message;
        creditsUsed = result.tokensUsed > 0
          ? calculateCreditsFromTokens(result.tokensUsed)
          : calculateCreditsFromChars(run.promptBase?.length ?? 0, batchMessage.length);
      } catch (err: any) {
        // AI failed — do NOT deduct credits
        await outboundRunsRepository.setFailure(tenantId, runId, err.message || 'Erro ao gerar mensagem');
        return;
      }

      const aiConsumption = await billingService.consume({
        tenantId,
        type: 'AI',
        amount: creditsUsed,
        idempotencyKey: `billing:ai:${tenantId}:${runId}:batch:${batchIndex + 1}`,
        metadata: {
          runId,
          batch: batchIndex + 1,
          creditsUsed,
        },
      });

      if (!aiConsumption.consumed) {
        await outboundRunsRepository.setFailure(tenantId, runId,
          'Créditos de IA insuficientes para continuar o disparo.');
        return;
      }
    } else {
      batchMessage = manualMessage;
    }

    await outboundRunsRepository.setCurrentBatch(tenantId, runId, batchIndex + 1, batchMessage);

    for (let index = 0; index < batch.length; index++) {
      const item = batch[index];
      if (await outboundRunsRepository.isCancelRequested(tenantId, runId)) {
        await outboundRunsRepository.finalize(tenantId, runId, 'cancelled');
        return;
      }

      await outboundRunsRepository.updateItem(tenantId, runId, item.target, 'sending', { message: batchMessage });
      const result = await evolutionService.sendMessage(instanceName, item.target, batchMessage);
      await outboundRunsRepository.updateItem(
        tenantId,
        runId,
        item.target,
        result.success ? 'sent' : 'failed',
        { error: result.error, message: batchMessage },
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

      await outboundRunsRepository.refreshSummary(tenantId, runId);

      if (result.success) {
        await updateContactMessage(tenantId, { ...item, message: batchMessage, status: 'sent', updatedAt: new Date().toISOString() });
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

async function processWebhookEvent(payload: WebhookJobPayload): Promise<void> {
  const event = await webhookEventsRepository.findById(payload.webhookEventId);
  if (!event) {
    return;
  }

  if (event.status === 'processed') {
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

  new Worker<BlastJobPayload>('email-blasts', async (job) => {
    await processEmailBlast(job.data);
  }, { connection, concurrency: 3 });

  new Worker<BlastJobPayload>('whatsapp-blasts', async (job) => {
    await processWhatsAppBlast(job.data);
  }, { connection, concurrency: 2 });

  new Worker<WebhookJobPayload>('webhook-events', async (job) => {
    await processWebhookEvent(job.data);
  }, { connection, concurrency: 8 });
}