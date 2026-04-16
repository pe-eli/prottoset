import { isValidPlanId, type PlanId } from './plans';

export type OverrideStatus = 'active' | 'pending' | 'cancelled' | 'inactive';

export interface SubscriptionUserOverride {
  userId: string;
  forceStatus?: OverrideStatus;
  bypassLimits?: boolean;
  planId?: PlanId;
}

let cachedOverrides: SubscriptionUserOverride[] | null = null;

function parseOverrides(): SubscriptionUserOverride[] {
  const raw = process.env.SUBSCRIPTION_USER_OVERRIDES?.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => {
        const userId = typeof item.userId === 'string' ? item.userId.trim() : '';
        const forceStatus = typeof item.forceStatus === 'string' ? item.forceStatus : undefined;
        const bypassLimits = item.bypassLimits === true;
        const planIdRaw = typeof item.planId === 'string' ? item.planId : undefined;
        const planId = planIdRaw && isValidPlanId(planIdRaw) ? planIdRaw : undefined;

        return {
          userId,
          forceStatus: isOverrideStatus(forceStatus) ? forceStatus : undefined,
          bypassLimits,
          planId,
        };
      })
      .filter((item) => item.userId.length > 0);
  } catch {
    console.warn('[Subscriptions] SUBSCRIPTION_USER_OVERRIDES is not valid JSON');
    return [];
  }
}

function isOverrideStatus(value: string | undefined): value is OverrideStatus {
  return value === 'active' || value === 'pending' || value === 'cancelled' || value === 'inactive';
}

export function getSubscriptionOverride(userId: string): SubscriptionUserOverride | null {
  if (!cachedOverrides) {
    cachedOverrides = parseOverrides();
  }

  return cachedOverrides.find((item) => item.userId === userId) ?? null;
}

export function clearSubscriptionOverrideCache(): void {
  cachedOverrides = null;
}
