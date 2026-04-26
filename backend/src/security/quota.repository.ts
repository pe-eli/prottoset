import { tenantQuery } from '../db/pool';
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
    const { rows } = await tenantQuery<QuotaLimitRow>(
      tenantId,
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
    const { rows } = await tenantQuery<QuotaUsageRow>(
      tenantId,
      'SELECT used_count FROM quota_usage WHERE tenant_id = $1 AND quota_key = $2 AND usage_date = CURRENT_DATE',
      [tenantId, quotaKey],
    );
    return rows[0]?.used_count ?? 0;
  },

  async tryConsumeAtomic(tenantId: string, quotaKey: QuotaKey, cost: number): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const normalizedCost = Math.max(1, Math.floor(cost || 1));
    const limit = await this.resolveLimit(tenantId, quotaKey);

    if (normalizedCost > limit) {
      const used = await this.getUsage(tenantId, quotaKey);
      return {
        allowed: false,
        remaining: Math.max(0, limit - used),
        limit,
      };
    }

    const { rowCount, rows } = await tenantQuery<QuotaUsageRow>(
      tenantId,
      `INSERT INTO quota_usage (tenant_id, quota_key, usage_date, used_count, updated_at)
       VALUES ($1, $2, CURRENT_DATE, $3, now())
       ON CONFLICT (tenant_id, quota_key, usage_date)
       DO UPDATE SET
         used_count = quota_usage.used_count + EXCLUDED.used_count,
         updated_at = now()
       WHERE quota_usage.used_count + EXCLUDED.used_count <= $4
       RETURNING used_count`,
      [tenantId, quotaKey, normalizedCost, limit],
    );

    if ((rowCount ?? 0) > 0) {
      const usedAfter = rows[0]?.used_count ?? normalizedCost;
      return {
        allowed: true,
        remaining: Math.max(0, limit - usedAfter),
        limit,
      };
    }

    const used = await this.getUsage(tenantId, quotaKey);
    return {
      allowed: false,
      remaining: Math.max(0, limit - used),
      limit,
    };
  },

  async releaseAtomic(tenantId: string, quotaKey: QuotaKey, cost: number): Promise<void> {
    const normalizedCost = Math.max(1, Math.floor(cost || 1));

    await tenantQuery(
      tenantId,
      `UPDATE quota_usage
       SET used_count = GREATEST(0, used_count - $3),
           updated_at = now()
       WHERE tenant_id = $1
         AND quota_key = $2
         AND usage_date = CURRENT_DATE
         AND used_count > 0`,
      [tenantId, quotaKey, normalizedCost],
    );
  },
};
