import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../infrastructure/stripe', () => ({
  getStripeClient: vi.fn(() => null),
}));

vi.mock('./subscription.repository', () => ({
  subscriptionRepository: {
    findByStripeSubscriptionOrCustomer: vi.fn(),
    syncStripeSubscriptionAtomically: vi.fn(async () => ({})),
    findActiveByUserId: vi.fn(),
    findByStripeCustomerId: vi.fn(),
    updateByStripeSubscriptionId: vi.fn(),
    updateStatus: vi.fn(),
    findExpiredWithScheduledPlan: vi.fn(),
    listStripeManagedSubscriptions: vi.fn(async () => []),
  },
}));

vi.mock('./invoices.repository', () => ({
  invoicesRepository: {
    upsert: vi.fn(async () => {}),
    listByUserId: vi.fn(async () => []),
  },
}));

vi.mock('./usage.repository', () => ({
  usageRepository: {
    getUsageForMonth: vi.fn(async () => ({
      leadsUsed: 0,
      whatsappUsed: 0,
      emailsUsed: 0,
      quotesUsed: 0,
      aiCreditsUsed: 0,
    })),
  },
}));

vi.mock('../../config/subscription-overrides', () => ({
  getSubscriptionOverride: vi.fn(() => null),
}));

import { subscriptionService } from './subscription.service';
import { subscriptionRepository } from './subscription.repository';

describe('subscriptionService.syncStripeSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when metadata and fallback identity are missing', async () => {
    vi.mocked(subscriptionRepository.findByStripeSubscriptionOrCustomer).mockResolvedValue(null);

    await expect(
      subscriptionService.syncStripeSubscription({
        id: 'sub_001',
        status: 'active',
        customer: 'cus_001',
        items: { data: [{ price: { id: 'price_1' } }] },
        current_period_start: 1714300000,
        current_period_end: 1716900000,
        metadata: {},
        cancel_at_period_end: false,
      }),
    ).rejects.toThrow(/sem referência de usuário\/plano/i);

    expect(subscriptionRepository.syncStripeSubscriptionAtomically).not.toHaveBeenCalled();
  });

  it('uses repository fallback when metadata is missing', async () => {
    vi.mocked(subscriptionRepository.findByStripeSubscriptionOrCustomer).mockResolvedValue({
      id: 'local-sub-1',
      userId: 'user-1',
      planId: 'solo',
      status: 'pending',
      stripeCustomerId: 'cus_001',
      stripeSubscriptionId: 'sub_001',
      stripePriceId: 'price_legacy',
      scheduledPlan: null,
      cancelAtPeriodEnd: false,
      mpSubscriptionId: null,
      mpPayerId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await subscriptionService.syncStripeSubscription({
      id: 'sub_001',
      status: 'active',
      customer: 'cus_001',
      items: { data: [{ price: { id: 'price_1' } }] },
      current_period_start: 1714300000,
      current_period_end: 1716900000,
      metadata: {},
      cancel_at_period_end: false,
    });

    expect(subscriptionRepository.syncStripeSubscriptionAtomically).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        planId: 'solo',
        stripeSubscriptionId: 'sub_001',
        stripeCustomerId: 'cus_001',
        stripePriceId: 'price_1',
      }),
    );
  });
});
