import { subscriptionRepository } from '../modules/subscriptions/subscription.repository';
import { subscriptionService } from '../modules/subscriptions/subscription.service';

const STRIPE_RECONCILIATION_INTERVAL_MS = 30 * 60 * 1000;

export function startStripeReconciliationCron(): void {
  void runStripeReconciliationCycle();

  setInterval(() => {
    void runStripeReconciliationCycle();
  }, STRIPE_RECONCILIATION_INTERVAL_MS);
}

async function runStripeReconciliationCycle(): Promise<void> {
  try {
    const candidates = await subscriptionRepository.listStripeManagedSubscriptions({
      statuses: ['active', 'past_due', 'pending', 'incomplete', 'trialing'],
      updatedBeforeMinutes: 20,
      limit: 120,
    });

    if (candidates.length === 0) return;

    let refreshed = 0;
    let failed = 0;

    for (const sub of candidates) {
      if (!sub.stripeSubscriptionId) continue;
      try {
        await subscriptionService.refreshStripeSubscriptionFromProvider(sub.stripeSubscriptionId);
        refreshed += 1;
      } catch (err: unknown) {
        failed += 1;
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('[StripeReconciliation] Failed to refresh Stripe subscription', {
          subscriptionId: sub.stripeSubscriptionId,
          userId: sub.userId,
          message,
        });
      }
    }

    if (failed > 0) {
      console.error('[StripeReconciliation] Completed with failures', {
        refreshed,
        failed,
        scanned: candidates.length,
      });
      return;
    }

    if (refreshed > 0) {
      console.log('[StripeReconciliation] Refreshed Stripe subscriptions', {
        refreshed,
        scanned: candidates.length,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[StripeReconciliation] cycle failed:', message);
  }
}
