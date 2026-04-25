import { quotaRepository } from '../../security/quota.repository';
import type { QuotaKey } from '../../security/quotas';

export const quotaService = {
  async reserveDailyQuota(tenantId: string, quotaKey: QuotaKey, cost: number): Promise<{
    allowed: boolean;
    remaining: number;
    limit: number;
  }> {
    return quotaRepository.tryConsumeAtomic(tenantId, quotaKey, cost);
  },

  async refundDailyQuota(tenantId: string, quotaKey: QuotaKey, cost: number): Promise<void> {
    await quotaRepository.releaseAtomic(tenantId, quotaKey, cost);
  },

  async getDailyQuota(tenantId: string, quotaKey: QuotaKey): Promise<{
    used: number;
    limit: number;
    remaining: number;
  }> {
    const [used, limit] = await Promise.all([
      quotaRepository.getUsage(tenantId, quotaKey),
      quotaRepository.resolveLimit(tenantId, quotaKey),
    ]);

    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
    };
  },
};
