import type { SubscriptionFeature } from '../../config/plans';
import { withDistributedLock } from '../../infrastructure/distributed-lock';
import { auditLogService } from '../../observability/audit-log.service';
import { metricsService } from '../../observability/metrics.service';
import { quotaService } from './quota.service';
import type { QuotaKey } from '../../security/quotas';
import { billingEngine } from './billing-engine.service';

export interface ExecutePaidActionInput<T> {
  tenantId: string;
  actorId?: string;
  feature: SubscriptionFeature;
  amount: number;
  idempotencyKey: string;
  actionName: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  quota?: {
    quotaKey: QuotaKey;
    cost: number;
  };
  action: () => Promise<T>;
}

export interface ExecutePaidActionResult<T> {
  ok: boolean;
  idempotentReplay: boolean;
  reason?: string;
  result?: T;
}

export const actionOrchestrator = {
  async execute<T>(input: ExecutePaidActionInput<T>): Promise<ExecutePaidActionResult<T>> {
    return withDistributedLock(`action:${input.tenantId}:${input.idempotencyKey}`, async () => {
      let quotaReserved = false;

      if (input.quota) {
        const quota = await quotaService.reserveDailyQuota(input.tenantId, input.quota.quotaKey, input.quota.cost);
        if (!quota.allowed) {
          await auditLogService.record({
            tenantId: input.tenantId,
            actorId: input.actorId,
            action: `${input.actionName}.quota_blocked`,
            status: 'blocked',
            correlationId: input.correlationId,
            details: {
              quotaKey: input.quota.quotaKey,
              limit: quota.limit,
              remaining: quota.remaining,
            },
          });
          return {
            ok: false,
            idempotentReplay: false,
            reason: 'quota_exceeded',
          };
        }
        quotaReserved = true;
      }

      const reservation = await billingEngine.reserveCredits({
        tenantId: input.tenantId,
        feature: input.feature,
        amount: input.amount,
        idempotencyKey: input.idempotencyKey,
        metadata: {
          ...(input.metadata ?? {}),
          actionName: input.actionName,
          correlationId: input.correlationId,
        },
      });

      if (!reservation.ok || !reservation.transaction) {
        if (quotaReserved && input.quota) {
          await quotaService.refundDailyQuota(input.tenantId, input.quota.quotaKey, input.quota.cost);
        }

        await auditLogService.record({
          tenantId: input.tenantId,
          actorId: input.actorId,
          action: `${input.actionName}.billing_blocked`,
          status: 'blocked',
          correlationId: input.correlationId,
          details: {
            feature: input.feature,
            reason: reservation.reason,
            idempotentReplay: reservation.idempotentReplay,
          },
        });

        return {
          ok: false,
          idempotentReplay: reservation.idempotentReplay,
          reason: reservation.reason,
        };
      }

      if (reservation.idempotentReplay && reservation.transaction.status === 'COMMITTED') {
        await auditLogService.record({
          tenantId: input.tenantId,
          actorId: input.actorId,
          action: `${input.actionName}.replay`,
          status: 'replayed',
          correlationId: input.correlationId,
          details: {
            transactionId: reservation.transaction.id,
            feature: input.feature,
          },
        });

        return {
          ok: true,
          idempotentReplay: true,
        };
      }

      const startedAt = Date.now();

      try {
        const result = await input.action();
        const committed = await billingEngine.commit(reservation.transaction.id, {
          actionName: input.actionName,
          correlationId: input.correlationId,
          ...(input.metadata ?? {}),
        });

        if (!committed.ok) {
          throw new Error(committed.reason || 'billing_commit_failed');
        }

        metricsService.increment({
          name: 'action.orchestrator.success',
          labels: {
            action: input.actionName,
            feature: input.feature,
          },
        });
        metricsService.observeDuration({
          name: 'action.orchestrator.duration',
          startedAt,
          labels: {
            action: input.actionName,
          },
        });

        await auditLogService.record({
          tenantId: input.tenantId,
          actorId: input.actorId,
          action: input.actionName,
          status: 'success',
          correlationId: input.correlationId,
          targetType: 'credit_transaction',
          targetId: reservation.transaction.id,
          details: {
            feature: input.feature,
            amount: input.amount,
            idempotencyKey: input.idempotencyKey,
            ...(input.metadata ?? {}),
          },
        });

        return {
          ok: true,
          idempotentReplay: committed.idempotentReplay || reservation.idempotentReplay,
          result,
        };
      } catch (err) {
        await billingEngine.refund(
          reservation.transaction.id,
          err instanceof Error ? err.message : 'action_failed',
          {
            actionName: input.actionName,
            correlationId: input.correlationId,
          },
        );

        if (quotaReserved && input.quota) {
          await quotaService.refundDailyQuota(input.tenantId, input.quota.quotaKey, input.quota.cost);
        }

        await auditLogService.record({
          tenantId: input.tenantId,
          actorId: input.actorId,
          action: input.actionName,
          status: 'failed',
          correlationId: input.correlationId,
          targetType: 'credit_transaction',
          targetId: reservation.transaction.id,
          details: {
            feature: input.feature,
            amount: input.amount,
            idempotencyKey: input.idempotencyKey,
            error: err instanceof Error ? err.message : 'unknown_error',
            ...(input.metadata ?? {}),
          },
        });

        return {
          ok: false,
          idempotentReplay: false,
          reason: err instanceof Error ? err.message : 'action_failed',
        };
      }
    });
  },
};
