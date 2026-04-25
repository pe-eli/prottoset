import { query } from '../../db/pool';
import { FEATURE_LIMIT_MAP, FEATURE_USAGE_COLUMN, type SubscriptionFeature } from '../../config/plans';
import { fraudService } from '../../security/fraud.service';
import { billingEngine } from '../billing/billing-engine.service';

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
    const consumption = await billingEngine.consumeImmediate({
      tenantId: input.tenantId,
      feature,
      amount,
      idempotencyKey,
      metadata: {
        ...(metadata ?? {}),
        source: 'billing.service.consume',
        billingType: input.type,
      },
    });

    if (!consumption.consumed) {
      await query(
        `UPDATE billing_consumptions
         SET status = 'failed',
             failure_reason = $2,
             processed_at = now()
         WHERE id = $1`,
        [billingId, consumption.reason ?? 'billing_engine_rejected'],
      );
      return {
        consumed: false,
        reason: consumption.reason ?? 'limit_exceeded',
        idempotentReplay: consumption.idempotentReplay,
      };
    }

    await query(
      `UPDATE billing_consumptions
       SET status = 'processed',
           processed_at = now(),
           failure_reason = NULL,
           metadata = metadata || $2::jsonb
       WHERE id = $1`,
      [billingId, JSON.stringify({ creditTransactionId: consumption.transactionId ?? null })],
    );

    if (input.type === 'AI') {
      await fraudService.detectAiSpikeAndBlock(input.tenantId);
    }

    return { consumed: true, idempotentReplay: consumption.idempotentReplay };
  },

  getFeatureForType(type: BillingType): SubscriptionFeature {
    return FEATURE_BY_BILLING_TYPE[type];
  },

  getLimitKeyForType(type: BillingType): keyof typeof FEATURE_LIMIT_MAP {
    return FEATURE_BY_BILLING_TYPE[type];
  },
};
