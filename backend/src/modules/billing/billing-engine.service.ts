import type { SubscriptionFeature } from '../../config/plans';
import { withDistributedLock } from '../../infrastructure/distributed-lock';
import { auditLogService } from '../../observability/audit-log.service';
import { metricsService } from '../../observability/metrics.service';
import { structuredLogger } from '../../observability/structured-logger';
import { creditLedgerRepository, type CreditTransaction } from './credit-ledger.repository';
import { usageTrackerService } from './usage-tracker.service';

interface ReserveCreditsInput {
  tenantId: string;
  feature: SubscriptionFeature;
  amount: number;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

interface ReserveCreditsResult {
  ok: boolean;
  reason?: string;
  idempotentReplay: boolean;
  transaction?: CreditTransaction;
}

function normalizeAmount(rawAmount: number): number {
  return Math.max(1, Math.floor(rawAmount || 1));
}

async function recordAuditSafely(input: Parameters<typeof auditLogService.record>[0]): Promise<void> {
  try {
    await auditLogService.record(input);
  } catch (err) {
    structuredLogger.warn('audit_log_write_failed', {
      action: input.action,
      tenantId: input.tenantId,
      error: err instanceof Error ? err.message : 'unknown_error',
    });
  }
}

function asReplayResult(existing: CreditTransaction): ReserveCreditsResult {
  if (existing.status === 'COMMITTED') {
    return {
      ok: true,
      idempotentReplay: true,
      transaction: existing,
    };
  }

  if (existing.status === 'PENDING') {
    return {
      ok: false,
      reason: 'credit_transaction_in_progress',
      idempotentReplay: true,
      transaction: existing,
    };
  }

  return {
    ok: false,
    reason: existing.failureReason || 'credit_transaction_not_allowed',
    idempotentReplay: true,
    transaction: existing,
  };
}

export const billingEngine = {
  async reserveCredits(input: ReserveCreditsInput): Promise<ReserveCreditsResult> {
    const amount = normalizeAmount(input.amount);

    if (!input.idempotencyKey || input.idempotencyKey.trim().length < 8) {
      throw new Error('idempotencyKey invalida para BillingEngine');
    }

    const idempotencyKey = input.idempotencyKey.trim();

    return withDistributedLock(
      `billing:reserve:${input.tenantId}:${input.feature}:${idempotencyKey}`,
      async () => {
        const existing = await creditLedgerRepository.getByIdempotencyKey(input.tenantId, idempotencyKey);
        if (existing) {
          return asReplayResult(existing);
        }

        const pending = await creditLedgerRepository.createPending({
          tenantId: input.tenantId,
          feature: input.feature,
          amount,
          idempotencyKey,
          metadata: {
            ...(input.metadata ?? {}),
            stage: 'reserve',
          },
        });

        if (!pending) {
          const replay = await creditLedgerRepository.getByIdempotencyKey(input.tenantId, idempotencyKey);
          if (!replay) {
            return {
              ok: false,
              reason: 'credit_transaction_conflict',
              idempotentReplay: true,
            };
          }
          return asReplayResult(replay);
        }

        const limitCheck = await usageTrackerService.checkFeatureLimit(input.tenantId, input.feature);
        if (!limitCheck.allowed) {
          await creditLedgerRepository.markFailed(input.tenantId, pending.id, 'limit_exceeded', {
            used: limitCheck.used,
            limit: limitCheck.limit,
          });

          await recordAuditSafely({
            tenantId: input.tenantId,
            action: 'credits.reserve',
            status: 'blocked',
            targetType: 'credit_transaction',
            targetId: pending.id,
            details: {
              reason: 'limit_exceeded',
              feature: input.feature,
              used: limitCheck.used,
              limit: limitCheck.limit,
            },
          });

          return {
            ok: false,
            reason: 'limit_exceeded',
            idempotentReplay: false,
            transaction: pending,
          };
        }

        const reserved = await usageTrackerService.reserveMonthlyUsage(
          input.tenantId,
          input.feature,
          amount,
          limitCheck.limit,
        );

        if (!reserved) {
          await creditLedgerRepository.markFailed(input.tenantId, pending.id, 'atomic_limit_check_failed', {
            used: limitCheck.used,
            limit: limitCheck.limit,
          });

          return {
            ok: false,
            reason: 'limit_exceeded',
            idempotentReplay: false,
            transaction: pending,
          };
        }

        metricsService.increment({
          name: 'billing.reserve.success',
          labels: { feature: input.feature },
        });

        await recordAuditSafely({
          tenantId: input.tenantId,
          action: 'credits.reserve',
          status: 'success',
          targetType: 'credit_transaction',
          targetId: pending.id,
          details: {
            feature: input.feature,
            amount,
            idempotencyKey,
          },
        });

        return {
          ok: true,
          idempotentReplay: false,
          transaction: pending,
        };
      },
    );
  },

  async commit(
    tenantId: string,
    transactionId: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ ok: boolean; idempotentReplay: boolean; reason?: string }> {
    return withDistributedLock(`billing:commit:${tenantId}:${transactionId}`, async () => {
      const transaction = await creditLedgerRepository.getById(tenantId, transactionId);
      if (!transaction) {
        return { ok: false, idempotentReplay: false, reason: 'transaction_not_found' };
      }

      if (transaction.status === 'COMMITTED') {
        return { ok: true, idempotentReplay: true };
      }

      if (transaction.status === 'FAILED') {
        return { ok: false, idempotentReplay: false, reason: transaction.failureReason || 'transaction_failed' };
      }

      if (transaction.status === 'REFUNDED') {
        return { ok: false, idempotentReplay: true, reason: 'transaction_refunded' };
      }

      await creditLedgerRepository.markCommitted(tenantId, transaction.id, metadata);

      metricsService.increment({
        name: 'billing.commit.success',
        labels: { feature: transaction.feature },
      });

      await recordAuditSafely({
        tenantId: transaction.tenantId,
        action: 'credits.commit',
        status: 'success',
        targetType: 'credit_transaction',
        targetId: transaction.id,
        details: {
          feature: transaction.feature,
          amount: transaction.amount,
          metadata: metadata ?? {},
        },
      });

      return { ok: true, idempotentReplay: false };
    });
  },

  async refund(
    tenantId: string,
    transactionId: string,
    reason: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ ok: boolean; idempotentReplay: boolean }> {
    return withDistributedLock(`billing:refund:${tenantId}:${transactionId}`, async () => {
      const transaction = await creditLedgerRepository.getById(tenantId, transactionId);
      if (!transaction) {
        return { ok: false, idempotentReplay: false };
      }

      if (transaction.status === 'REFUNDED') {
        return { ok: true, idempotentReplay: true };
      }

      if (transaction.status === 'FAILED') {
        return { ok: true, idempotentReplay: true };
      }

      await usageTrackerService.refundMonthlyUsage(transaction.tenantId, transaction.feature, transaction.amount);
        await creditLedgerRepository.markRefunded(tenantId, transaction.id, reason, metadata);

      metricsService.increment({
        name: 'billing.refund.success',
        labels: { feature: transaction.feature },
      });

      await recordAuditSafely({
        tenantId: transaction.tenantId,
        action: 'credits.refund',
        status: 'success',
        targetType: 'credit_transaction',
        targetId: transaction.id,
        details: {
          feature: transaction.feature,
          amount: transaction.amount,
          reason,
          metadata: metadata ?? {},
        },
      });

      return { ok: true, idempotentReplay: false };
    });
  },

  async consumeImmediate(input: ReserveCreditsInput): Promise<{
    consumed: boolean;
    reason?: string;
    idempotentReplay: boolean;
    transactionId?: string;
  }> {
    const reserved = await this.reserveCredits(input);
    if (!reserved.ok || !reserved.transaction) {
      return {
        consumed: false,
        reason: reserved.reason,
        idempotentReplay: reserved.idempotentReplay,
      };
    }

    if (reserved.idempotentReplay && reserved.transaction.status === 'COMMITTED') {
      return {
        consumed: true,
        idempotentReplay: true,
        transactionId: reserved.transaction.id,
      };
    }

    const committed = await this.commit(input.tenantId, reserved.transaction.id);
    if (!committed.ok) {
      if (!committed.idempotentReplay) {
        await this.refund(input.tenantId, reserved.transaction.id, committed.reason || 'commit_failed', {
          stage: 'consumeImmediate',
        });
      }

      return {
        consumed: false,
        reason: committed.reason,
        idempotentReplay: committed.idempotentReplay,
        transactionId: reserved.transaction.id,
      };
    }

    return {
      consumed: true,
      idempotentReplay: reserved.idempotentReplay || committed.idempotentReplay,
      transactionId: reserved.transaction.id,
    };
  },
};
