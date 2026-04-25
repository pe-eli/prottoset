import { FEATURE_USAGE_COLUMN, type SubscriptionFeature } from '../../config/plans';
import { subscriptionService } from '../subscriptions/subscription.service';
import { usageRepository } from '../subscriptions/usage.repository';

export type UsageColumn = 'leads_used' | 'whatsapp_used' | 'emails_used' | 'quotes_used' | 'ai_credits_used';

export const usageTrackerService = {
  getUsageColumn(feature: SubscriptionFeature): UsageColumn {
    return FEATURE_USAGE_COLUMN[feature] as UsageColumn;
  },

  async checkFeatureLimit(tenantId: string, feature: SubscriptionFeature): Promise<{
    allowed: boolean;
    used: number;
    limit: number | null;
  }> {
    return subscriptionService.checkLimit(tenantId, feature);
  },

  async reserveMonthlyUsage(
    tenantId: string,
    feature: SubscriptionFeature,
    amount: number,
    limit: number | null,
  ): Promise<boolean> {
    const column = this.getUsageColumn(feature);
    return usageRepository.consumeFeatureUsage(tenantId, column, amount, limit);
  },

  async refundMonthlyUsage(
    tenantId: string,
    feature: SubscriptionFeature,
    amount: number,
  ): Promise<void> {
    const column = this.getUsageColumn(feature);
    await usageRepository.releaseFeatureUsage(tenantId, column, amount);
  },
};
