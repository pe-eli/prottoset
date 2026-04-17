import { query } from '../../db/pool';
import { FEATURE_LIMIT_MAP, FEATURE_USAGE_COLUMN, type SubscriptionFeature } from '../../config/plans';
import { fraudService } from '../../security/fraud.service';
import { subscriptionService } from './subscription.service';
import { usageRepository } from './usage.repository';

export type BillingType = 'AI' | 'EMAIL' | 'WHATSAPP' | 'PDF';

export interface BillingConsumeInput {
  tenantId: string;
  type: BillingType;
  amount: number;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

interface BillingRow {
  id: string;
  status: 'pending' | 'processed' | 'failed';
  failure_reason: string | null;
}

const FEATURE_BY_BILLING_TYPE: Record<BillingType, SubscriptionFeature> = {
  AI: 'ai_credits',
  EMAIL: 'emails',
  WHATSAPP: 'whatsapp',
  PDF: 'quotes',
};

function getUsageColumnForType(type: BillingType): 'leads_used' | 'whatsapp_used' | 'emails_used' | 'quotes_used' | 'ai_credits_used' {
  const feature = FEATURE_BY_BILLING_TYPE[type];
  const column = FEATURE_USAGE_COLUMN[feature];
  return column as 'leads_used' | 'whatsapp_used' | 'emails_used' | 'quotes_used' | 'ai_credits_used';
}

async function getExistingByIdempotencyKey(idempotencyKey: string): Promise<BillingRow | null> {
  const { rows } = await query<BillingRow>(
    `SELECT id, status, failure_reason
     FROM billing_consumptions
     WHERE idempotency_key = $1
     LIMIT 1`,
    [idempotencyKey],
  );
  return rows[0] ?? null;
}

export const billingService = {
  async consume(input: BillingConsumeInput): Promise<{ consumed: boolean; reason?: string; idempotentReplay: boolean }> {
    const amount = Math.max(1, Math.floor(input.amount));
    if (!input.idempotencyKey || input.idempotencyKey.trim().length < 8) {
      throw new Error('idempotencyKey inválida para billing');
    }

    const idempotencyKey = input.idempotencyKey.trim();
    const metadata = input.metadata ?? {};

    // Fast idempotency path.
    const existing = await getExistingByIdempotencyKey(idempotencyKey);
    if (existing?.status === 'processed') {
      return { consumed: true, idempotentReplay: true };
    }
    if (existing?.status === 'failed') {
      return { consumed: false, reason: existing.failure_reason ?? 'consumo_falhou', idempotentReplay: true };
    }

    const { rows } = await query<{ id: string }>(
      `INSERT INTO billing_consumptions (tenant_id, idempotency_key, consumption_type, amount, status, metadata)
       VALUES ($1, $2, $3, $4, 'pending', $5::jsonb)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      [input.tenantId, idempotencyKey, input.type, amount, JSON.stringify(metadata)],
    );

    if (!rows[0]) {
      const replay = await getExistingByIdempotencyKey(idempotencyKey);
      if (replay?.status === 'processed') {
        return { consumed: true, idempotentReplay: true };
      }
      return { consumed: false, reason: replay?.failure_reason ?? 'consumo_em_andamento', idempotentReplay: true };
    }

    const billingId = rows[0].id;
    const feature = FEATURE_BY_BILLING_TYPE[input.type];
    const limitCheck = await subscriptionService.checkLimit(input.tenantId, feature);

    if (!limitCheck.allowed) {
      await query(
        `UPDATE billing_consumptions
         SET status = 'failed',
             failure_reason = $2,
             processed_at = now()
         WHERE id = $1`,
        [billingId, 'limit_exceeded'],
      );
      return { consumed: false, reason: 'limit_exceeded', idempotentReplay: false };
    }

    const column = getUsageColumnForType(input.type);
    const consumed = await usageRepository.consumeFeatureUsage(input.tenantId, column, amount, limitCheck.limit);
    if (!consumed) {
      await query(
        `UPDATE billing_consumptions
         SET status = 'failed',
             failure_reason = $2,
             processed_at = now()
         WHERE id = $1`,
        [billingId, 'atomic_limit_check_failed'],
      );
      return { consumed: false, reason: 'limit_exceeded', idempotentReplay: false };
    }

    await query(
      `UPDATE billing_consumptions
       SET status = 'processed',
           processed_at = now(),
           failure_reason = NULL
       WHERE id = $1`,
      [billingId],
    );

    if (input.type === 'AI') {
      await fraudService.detectAiSpikeAndBlock(input.tenantId);
    }

    return { consumed: true, idempotentReplay: false };
  },

  getFeatureForType(type: BillingType): SubscriptionFeature {
    return FEATURE_BY_BILLING_TYPE[type];
  },

  getLimitKeyForType(type: BillingType): keyof typeof FEATURE_LIMIT_MAP {
    return FEATURE_BY_BILLING_TYPE[type];
  },
};
