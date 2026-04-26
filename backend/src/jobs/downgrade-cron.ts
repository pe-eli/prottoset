/**
 * Downgrade cron job — runs on server startup in a recurring loop.
 *
 * For each subscription where:
 *   - scheduledPlan IS NOT NULL
 *   - status IS active or trialing
 *   - current_period_end <= now()
 *
 * We apply the downgrade immediately on Stripe and clear scheduledPlan.
 */
import Stripe = require('stripe');

type StripeInstance = InstanceType<typeof Stripe>;
import { getStripeClient } from '../infrastructure/stripe';
import { subscriptionRepository } from '../modules/subscriptions/subscription.repository';
import { PLANS, isValidPlanId } from '../config/plans';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function startDowngradeCronJob(): void {
  console.log('[DowngradeCron] Starting scheduled downgrade processor');

  void runDowngradeCycle();

  setInterval(() => {
    void runDowngradeCycle();
  }, CHECK_INTERVAL_MS);
}

async function runDowngradeCycle(): Promise<void> {
  try {
    const stripe = getStripeClient();
    if (!stripe) {
      console.warn('[DowngradeCron] Stripe not configured — skipping cycle');
      return;
    }

    const pending = await subscriptionRepository.findExpiredWithScheduledPlan();
    if (pending.length === 0) return;

    console.log(`[DowngradeCron] Processing ${pending.length} scheduled downgrade(s)`);

    for (const sub of pending) {
      try {
        await applyDowngrade(stripe, sub.stripeSubscriptionId!, sub.scheduledPlan!);
        await subscriptionRepository.updateByStripeSubscriptionId(sub.stripeSubscriptionId!, {
          planId: sub.scheduledPlan!,
          scheduledPlan: null,
        });
        console.log(`[DowngradeCron] Applied downgrade for sub ${sub.stripeSubscriptionId}: ${sub.planId} → ${sub.scheduledPlan}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[DowngradeCron] Failed to apply downgrade for sub ${sub.stripeSubscriptionId}:`, msg);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[DowngradeCron] Cycle error:', msg);
  }
}

async function applyDowngrade(stripe: StripeInstance, stripeSubId: string, newPlanId: string): Promise<void> {
  if (!isValidPlanId(newPlanId)) throw new Error(`Invalid plan ID: ${newPlanId}`);

  const plan = PLANS[newPlanId];
  if (!plan.stripe_price_id) throw new Error(`Stripe price ID not configured for plan ${newPlanId}`);

  const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
  const itemId = stripeSub.items.data[0]?.id;
  if (!itemId) throw new Error(`No subscription item found for ${stripeSubId}`);

  // Apply immediately at next billing cycle (no proration for downgrade)
  await stripe.subscriptions.update(stripeSubId, {
    items: [{ id: itemId, price: plan.stripe_price_id }],
    proration_behavior: 'none',
  });
}
