import { query } from '../db/pool';
import type { QuotaKey } from './quotas';
import { DEFAULT_QUOTAS } from './quotas';

interface QuotaLimitRow {
  daily_limit: number;
}

interface QuotaUsageRow {
  used_count: number;
}

export const quotaRepository = {
  async resolveLimit(tenantId: string, quotaKey: QuotaKey): Promise<number> {
    const { rows } = await query<QuotaLimitRow>(
      `SELECT daily_limit
       FROM quota_limits
       WHERE quota_key = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
       ORDER BY CASE WHEN tenant_id = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [quotaKey, tenantId],
    );
    return rows[0]?.daily_limit ?? DEFAULT_QUOTAS[quotaKey];
  },

  async getUsage(tenantId: string, quotaKey: QuotaKey): Promise<number> {
    const { rows } = await query<QuotaUsageRow>(
      'SELECT used_count FROM quota_usage WHERE tenant_id = $1 AND quota_key = $2 AND usage_date = CURRENT_DATE',
      [tenantId, quotaKey],
    );
    return rows[0]?.used_count ?? 0;
  },

  async ensureWithinLimit(tenantId: string, quotaKey: QuotaKey, cost: number): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const limit = await this.resolveLimit(tenantId, quotaKey);
    const used = await this.getUsage(tenantId, quotaKey);
    const remaining = Math.max(0, limit - used);
    return {
      allowed: used + cost <= limit,
      remaining,
      limit,
    };
  },

  async consume(tenantId: string, quotaKey: QuotaKey, cost: number): Promise<void> {
    await query(
      `INSERT INTO quota_usage (tenant_id, quota_key, usage_date, used_count, updated_at)
       VALUES ($1, $2, CURRENT_DATE, $3, now())
       ON CONFLICT (tenant_id, quota_key, usage_date)
       DO UPDATE SET
         used_count = quota_usage.used_count + EXCLUDED.used_count,
         updated_at = now()`,
      [tenantId, quotaKey, cost],
    );
  },
};