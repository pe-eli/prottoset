import crypto from 'crypto';
import { withDistributedLock } from '../../infrastructure/distributed-lock';
import { billingEngine } from '../billing/billing-engine.service';
import { calculateCreditsFromChars, calculateCreditsFromTokens } from '../subscriptions/ai-credits';
import { deepseekService } from '../../services/deepseek.service';
import { auditLogService } from '../../observability/audit-log.service';
import { metricsService } from '../../observability/metrics.service';

export interface AIGenerateInput {
  tenantId: string;
  prompt: string;
  source: 'blast' | 'reply' | 'test';
  idempotencyKey?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface AIGenerateResult {
  message: string;
  tokensUsed: number;
  billedCredits: number;
  promptHash: string;
  idempotencyKey: string;
}

function hashPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex');
}

function estimateCredits(prompt: string): number {
  const expectedResponseChars = 320;
  return Math.max(1, calculateCreditsFromChars(prompt.length, expectedResponseChars));
}

export const aiOrchestrator = {
  async generate(input: AIGenerateInput): Promise<AIGenerateResult> {
    const prompt = input.prompt.trim();
    if (!prompt) {
      throw new Error('Prompt vazio para geracao IA');
    }

    const promptHash = hashPrompt(prompt);
    const idempotencyKey = input.idempotencyKey?.trim()
      || `ai:${input.tenantId}:${input.source}:${promptHash}:${crypto.randomUUID()}`;

    const estimatedCredits = estimateCredits(prompt);

    return withDistributedLock(
      `ai:generate:${input.tenantId}:${promptHash}`,
      async () => {
        const startedAt = Date.now();

        const reserved = await billingEngine.reserveCredits({
          tenantId: input.tenantId,
          feature: 'ai_credits',
          amount: estimatedCredits,
          idempotencyKey,
          metadata: {
            source: input.source,
            promptHash,
            estimatedCredits,
            correlationId: input.correlationId,
            ...(input.metadata ?? {}),
          },
        });

        if (!reserved.ok || !reserved.transaction) {
          throw new Error('Creditos de IA insuficientes');
        }

        if (reserved.idempotentReplay && reserved.transaction.status === 'COMMITTED') {
          throw new Error('Operacao de IA ja processada com a mesma idempotency key');
        }

        try {
          const generated = await deepseekService.generateWhatsAppMessage(prompt, {
            tenantId: input.tenantId,
            source: input.source,
          });

          const message = (generated.message || '').trim();
          if (!message) {
            throw new Error('Provider de IA retornou mensagem vazia');
          }

          const actualCredits = generated.tokensUsed > 0
            ? Math.max(1, calculateCreditsFromTokens(generated.tokensUsed))
            : Math.max(1, calculateCreditsFromChars(prompt.length, message.length));

          // Preserva semantica de reserva: cobranca principal ja foi reservada antes da execucao.
          // Se o custo real exceder estimativa, faz complemento idempotente.
          if (actualCredits > estimatedCredits) {
            const topUpAmount = actualCredits - estimatedCredits;
            const topUp = await billingEngine.consumeImmediate({
              tenantId: input.tenantId,
              feature: 'ai_credits',
              amount: topUpAmount,
              idempotencyKey: `${idempotencyKey}:topup:${topUpAmount}`,
              metadata: {
                source: input.source,
                promptHash,
                topUpAmount,
                correlationId: input.correlationId,
              },
            });

            if (!topUp.consumed) {
              throw new Error('Creditos de IA insuficientes para completar geracao');
            }
          }

          const committed = await billingEngine.commit(input.tenantId, reserved.transaction.id, {
            promptHash,
            source: input.source,
            estimatedCredits,
            actualCredits,
            tokensUsed: generated.tokensUsed,
            correlationId: input.correlationId,
            ...(input.metadata ?? {}),
          });

          if (!committed.ok) {
            throw new Error(committed.reason || 'Falha ao confirmar cobranca de IA');
          }

          metricsService.increment({
            name: 'ai.generate.success',
            labels: {
              source: input.source,
            },
          });
          metricsService.observeDuration({
            name: 'ai.generate.duration',
            startedAt,
            labels: {
              source: input.source,
            },
          });

          await auditLogService.record({
            tenantId: input.tenantId,
            action: 'ai.generate',
            status: 'success',
            targetType: 'credit_transaction',
            targetId: reserved.transaction.id,
            correlationId: input.correlationId,
            details: {
              source: input.source,
              promptHash,
              estimatedCredits,
              actualCredits,
              tokensUsed: generated.tokensUsed,
              idempotencyKey,
              ...(input.metadata ?? {}),
            },
          });

          return {
            message,
            tokensUsed: generated.tokensUsed,
            billedCredits: actualCredits,
            promptHash,
            idempotencyKey,
          };
        } catch (err) {
          await billingEngine.refund(
            input.tenantId,
            reserved.transaction.id,
            err instanceof Error ? err.message : 'ai_generation_failed',
            {
              source: input.source,
              promptHash,
              correlationId: input.correlationId,
              ...(input.metadata ?? {}),
            },
          );

          metricsService.increment({
            name: 'ai.generate.failed',
            labels: {
              source: input.source,
            },
          });

          throw err;
        }
      },
      { ttlMs: 25_000, timeoutMs: 8_000 },
    );
  },
};
