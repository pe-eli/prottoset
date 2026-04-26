import { tenantQuery } from '../../db/pool';
import type { SubscriptionFeature } from '../../config/plans';

export type CreditTransactionStatus = 'PENDING' | 'COMMITTED' | 'FAILED' | 'REFUNDED';

interface CreditTransactionRow {
  id: string;
  tenant_id: string;
  feature: SubscriptionFeature;
  amount: number;
  status: CreditTransactionStatus;
  idempotency_key: string;
  metadata: Record<string, unknown>;
  failure_reason: string | null;
  created_at: Date;
  committed_at: Date | null;
  refunded_at: Date | null;
}

export interface CreditTransaction {
  id: string;
  tenantId: string;
  feature: SubscriptionFeature;
  amount: number;
  status: CreditTransactionStatus;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  failureReason: string | null;
  createdAt: string;
  committedAt: string | null;
  refundedAt: string | null;
}

function mapRow(row: CreditTransactionRow): CreditTransaction {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    feature: row.feature,
    amount: row.amount,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    metadata: row.metadata ?? {},
    failureReason: row.failure_reason,
    createdAt: row.created_at.toISOString(),
    committedAt: row.committed_at ? row.committed_at.toISOString() : null,
    refundedAt: row.refunded_at ? row.refunded_at.toISOString() : null,
  };
}

export const creditLedgerRepository = {
  async getById(tenantId: string, transactionId: string): Promise<CreditTransaction | null> {
    const { rows } = await tenantQuery<CreditTransactionRow>(
      tenantId,
      `SELECT *
       FROM credit_transactions
       WHERE tenant_id = $1
         AND id = $2
       LIMIT 1`,
      [tenantId, transactionId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async getByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<CreditTransaction | null> {
    const { rows } = await tenantQuery<CreditTransactionRow>(
      tenantId,
      `SELECT *
       FROM credit_transactions
       WHERE tenant_id = $1
         AND idempotency_key = $2
       LIMIT 1`,
      [tenantId, idempotencyKey],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async createPending(input: {
    tenantId: string;
    feature: SubscriptionFeature;
    amount: number;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<CreditTransaction | null> {
    const { rows } = await tenantQuery<CreditTransactionRow>(
      input.tenantId,
      `INSERT INTO credit_transactions (
         tenant_id,
         feature,
         amount,
         status,
         idempotency_key,
         metadata
       )
       VALUES ($1, $2, $3, 'PENDING', $4, $5::jsonb)
       ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [
        input.tenantId,
        input.feature,
        input.amount,
        input.idempotencyKey,
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    return rows[0] ? mapRow(rows[0]) : null;
  },

  async markCommitted(tenantId: string, transactionId: string, metadata?: Record<string, unknown>): Promise<void> {
    await tenantQuery(
      tenantId,
      `UPDATE credit_transactions
       SET status = 'COMMITTED',
           committed_at = COALESCE(committed_at, now()),
           failure_reason = NULL,
           metadata = metadata || $2::jsonb
       WHERE id = $1 AND tenant_id = $3`,
      [transactionId, JSON.stringify(metadata ?? {}), tenantId],
    );
  },

  async markFailed(tenantId: string, transactionId: string, reason: string, metadata?: Record<string, unknown>): Promise<void> {
    await tenantQuery(
      tenantId,
      `UPDATE credit_transactions
       SET status = 'FAILED',
           failure_reason = $2,
           metadata = metadata || $3::jsonb
       WHERE id = $1 AND tenant_id = $4`,
      [transactionId, reason.slice(0, 300), JSON.stringify(metadata ?? {}), tenantId],
    );
  },

  async markRefunded(tenantId: string, transactionId: string, reason: string, metadata?: Record<string, unknown>): Promise<void> {
    await tenantQuery(
      tenantId,
      `UPDATE credit_transactions
       SET status = 'REFUNDED',
           failure_reason = $2,
           refunded_at = COALESCE(refunded_at, now()),
           metadata = metadata || $3::jsonb
       WHERE id = $1 AND tenant_id = $4`,
      [transactionId, reason.slice(0, 300), JSON.stringify(metadata ?? {}), tenantId],
    );
  },
};
