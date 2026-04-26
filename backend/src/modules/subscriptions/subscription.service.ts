import Stripe = require('stripe');
type StripeInstance = InstanceType<typeof Stripe>;
import { getStripeClient } from '../../infrastructure/stripe';
import { subscriptionRepository, type Subscription } from './subscription.repository';
import { invoicesRepository } from './invoices.repository';
import { usageRepository, type Usage } from './usage.repository';
import {
  PLANS,
  PLAN_RANK,
  getPublicPlans,
  isValidPlanId,
  FEATURE_LIMIT_MAP,
  type PlanId,
  type PlanLimits,
  type PublicPlan,
  type SubscriptionFeature,
} from '../../config/plans';
import { getSubscriptionOverride } from '../../config/subscription-overrides';

export interface SubscriptionInfo {
  planId: string;
  planName: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  scheduledPlan: string | null;
  currentPeriodEnd: string | null;
  usage: Usage;
  limits: PlanLimits;
}

export interface SubscriptionAccessState {
  subscription: Subscription | null;
  effectiveStatus: CanonicalSubscriptionStatus;
  isActive: boolean;
  planId: PlanId | null;
  bypassLimits: boolean;
}

type CanonicalSubscriptionStatus = 'active' | 'pending' | 'paused' | 'cancelled' | 'past_due' | 'inactive';

// ─── PUBLIC HELPERS ──────────────────────────────────────────

export const subscriptionService = {
  getPublicPlans(): PublicPlan[] {
    return getPublicPlans();
  },

  // ── STRIPE CHECKOUT SESSION ────────────────────────────────

  async createCheckoutSession(userId: string, userEmail: string, planId: string): Promise<string> {
    if (!isValidPlanId(planId)) throw new Error('Plano inválido');

    const stripe = getStripeClient();
    if (!stripe) throw new Error('Stripe não configurado');

    const plan = PLANS[planId];
    if (!plan.stripe_price_id) throw new Error('Price ID do Stripe não configurado para este plano');

    // If the user already has an active Stripe subscription, do NOT create a new checkout.
    // They must use change-plan instead.
    const existing = await subscriptionRepository.findActiveByUserId(userId);
    if (existing?.stripeSubscriptionId && normalizeStatus(existing.status) === 'active') {
      throw new Error('Você já possui uma assinatura ativa. Use a opção de troca de plano.');
    }

    // Find or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(stripe, userId, userEmail, existing?.stripeCustomerId ?? null);

    const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/home?stripe_success=1`;
    const cancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pricing`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId, planId },
      subscription_data: { metadata: { userId, planId } },
      allow_promotion_codes: true,
    });

    if (!session.url) throw new Error('Stripe não retornou URL de checkout');
    return session.url;
  },

  // ── CUSTOMER PORTAL ────────────────────────────────────────

  async createBillingPortalSession(userId: string): Promise<string> {
    const stripe = getStripeClient();
    if (!stripe) throw new Error('Stripe não configurado');

    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub?.stripeCustomerId) throw new Error('Nenhum perfil de cobrança encontrado');

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing`,
    });

    return session.url;
  },

  // ── CHANGE PLAN (upgrade / downgrade) ─────────────────────

  async changePlan(userId: string, newPlanId: string): Promise<{ immediate: boolean; effectiveAt: string | null }> {
    if (!isValidPlanId(newPlanId)) throw new Error('Plano inválido');

    const stripe = getStripeClient();
    if (!stripe) throw new Error('Stripe não configurado');

    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub?.stripeSubscriptionId) throw new Error('Nenhuma assinatura ativa com Stripe');
    if (sub.planId === newPlanId) throw new Error('Você já está neste plano');

    const newPlan = PLANS[newPlanId];
    if (!newPlan.stripe_price_id) throw new Error('Price ID do Stripe não configurado');

    const isUpgrade = (PLAN_RANK[newPlanId as PlanId] ?? 0) > (PLAN_RANK[sub.planId as PlanId] ?? 0);

    // Retrieve the current Stripe subscription to get the item ID
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    const itemId = stripeSub.items.data[0]?.id;
    if (!itemId) throw new Error('Item da assinatura não encontrado no Stripe');

    if (isUpgrade) {
      // IMMEDIATE: proration auto-calculated by Stripe
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        items: [{ id: itemId, price: newPlan.stripe_price_id }],
        proration_behavior: 'create_prorations',
        payment_behavior: 'pending_if_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });

      // Reflect immediately in our DB (webhook will confirm, but we update optimistically)
      await subscriptionRepository.updateByStripeSubscriptionId(sub.stripeSubscriptionId, {
        planId: newPlanId,
        stripePriceId: newPlan.stripe_price_id,
        scheduledPlan: null,
      });

      return { immediate: true, effectiveAt: null };
    } else {
      // DOWNGRADE: schedule for next cycle — do NOT touch Stripe subscription now.
      // Our cron job will apply it when current_period_end passes.
      await subscriptionRepository.updateByStripeSubscriptionId(sub.stripeSubscriptionId, {
        scheduledPlan: newPlanId,
      });

      return {
        immediate: false,
        effectiveAt: sub.currentPeriodEnd?.toISOString() ?? null,
      };
    }
  },

  // ── CANCEL SUBSCRIPTION ───────────────────────────────────

  async cancelSubscription(userId: string): Promise<void> {
    const stripe = getStripeClient();
    if (!stripe) throw new Error('Stripe não configurado');

    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub) throw new Error('Nenhuma assinatura ativa');

    if (sub.stripeSubscriptionId) {
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      await subscriptionRepository.updateByStripeSubscriptionId(sub.stripeSubscriptionId, {
        cancelAtPeriodEnd: true,
      });
    } else {
      // Legacy MP subscription
      await subscriptionRepository.updateStatus(userId, sub.id, 'cancelled');
    }
  },

  // ── REACTIVATE (undo cancel_at_period_end) ─────────────────

  async reactivateSubscription(userId: string): Promise<void> {
    const stripe = getStripeClient();
    if (!stripe) throw new Error('Stripe não configurado');

    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub?.stripeSubscriptionId) throw new Error('Nenhuma assinatura Stripe encontrada');
    if (!sub.cancelAtPeriodEnd) throw new Error('Assinatura não está agendada para cancelamento');

    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });
    await subscriptionRepository.updateByStripeSubscriptionId(sub.stripeSubscriptionId, {
      cancelAtPeriodEnd: false,
    });
  },

  // ── MY SUBSCRIPTION ────────────────────────────────────────

  async getMySubscription(userId: string): Promise<SubscriptionInfo | null> {
    const state = await this.resolveAccessState(userId);
    if (!state.subscription && !state.isActive) return null;

    const planId = state.planId;
    if (!planId) return null;

    const plan = PLANS[planId];
    const usage = await usageRepository.getUsageForMonth(userId);

    return {
      planId,
      planName: plan.name,
      status: state.effectiveStatus,
      cancelAtPeriodEnd: state.subscription?.cancelAtPeriodEnd ?? false,
      scheduledPlan: state.subscription?.scheduledPlan ?? null,
      currentPeriodEnd: state.subscription?.currentPeriodEnd?.toISOString() ?? null,
      usage,
      limits: plan.limits,
    };
  },

  // ── BILLING HISTORY (invoices) ─────────────────────────────

  async getBillingHistory(userId: string) {
    return invoicesRepository.listByUserId(userId);
  },

  // ── ACCESS STATE ───────────────────────────────────────────

  async resolveAccessState(userId: string): Promise<SubscriptionAccessState> {
    const override = getSubscriptionOverride(userId);
    const sub = await subscriptionRepository.findActiveByUserId(userId);

    const effectiveStatus = override?.forceStatus
      ? normalizeStatus(override.forceStatus)
      : normalizeStatus(sub?.status);
    const isActive = effectiveStatus === 'active' || effectiveStatus === 'past_due';

    const effectivePlanId = override?.planId ?? sub?.planId ?? null;
    const planId = effectivePlanId && isValidPlanId(effectivePlanId) ? effectivePlanId : null;

    return {
      subscription: sub ?? null,
      effectiveStatus,
      isActive,
      planId,
      bypassLimits: override?.bypassLimits === true,
    };
  },

  // ── QUOTA CHECK ────────────────────────────────────────────

  async checkLimit(userId: string, feature: SubscriptionFeature): Promise<{
    allowed: boolean;
    used: number;
    limit: number | null;
  }> {
    const state = await this.resolveAccessState(userId);
    if (state.bypassLimits) return { allowed: true, used: 0, limit: null };
    if (!state.isActive) return { allowed: false, used: 0, limit: 0 };

    const planId = state.planId;
    if (!planId) return { allowed: false, used: 0, limit: 0 };

    const plan = PLANS[planId];
    const limitKey = FEATURE_LIMIT_MAP[feature];
    const limit = plan.limits[limitKey] as number | null;

    if (limit === null) return { allowed: true, used: 0, limit: null };

    const usage = await usageRepository.getUsageForMonth(userId);
    const usageMap: Record<SubscriptionFeature, number> = {
      leads: usage.leadsUsed,
      whatsapp: usage.whatsappUsed,
      emails: usage.emailsUsed,
      quotes: usage.quotesUsed,
      ai_credits: usage.aiCreditsUsed,
    };

    const used = usageMap[feature];
    return { allowed: used < limit, used, limit };
  },

  // ── STRIPE WEBHOOK SYNC ────────────────────────────────────

  async syncStripeSubscription(stripeSub: Record<string, any>): Promise<void> {
    const userId = stripeSub.metadata?.userId;
    const planId = stripeSub.metadata?.planId;

    if (!userId || !planId || !isValidPlanId(planId)) {
      console.warn('[Stripe] syncStripeSubscription: missing/invalid metadata', {
        subId: stripeSub.id,
        userId,
        planId,
      });
      return;
    }

    const item = stripeSub.items.data[0];
    const priceId = item?.price?.id ?? '';
    const periodStart = new Date(stripeSub.current_period_start * 1000);
    const periodEnd = new Date(stripeSub.current_period_end * 1000);
    const customerId = typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer.id;

    await subscriptionRepository.upsertByStripeSubscriptionId({
      userId,
      planId,
      status: stripeSub.status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: stripeSub.id,
      stripePriceId: priceId,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });

    // Cancel all legacy non-Stripe active subscriptions for this user
    await subscriptionRepository.cancelAllLegacyActiveForUser(userId, stripeSub.id);
  },

  async handleStripeInvoice(stripeInvoice: Record<string, any>): Promise<void> {
    const customerId = typeof stripeInvoice.customer === 'string'
      ? stripeInvoice.customer
      : stripeInvoice.customer?.id ?? '';

    if (!customerId) return;

    const sub = await subscriptionRepository.findByStripeCustomerId(customerId);
    if (!sub) return;

    await invoicesRepository.upsert({
      userId: sub.userId,
      stripeInvoiceId: stripeInvoice.id,
      amount: stripeInvoice.amount_paid,
      currency: stripeInvoice.currency,
      status: stripeInvoice.status ?? 'open',
      hostedInvoiceUrl: stripeInvoice.hosted_invoice_url ?? null,
      invoicePdf: stripeInvoice.invoice_pdf ?? null,
      paidAt: stripeInvoice.status === 'paid' ? new Date(stripeInvoice.created * 1000) : null,
    });
  },

  /** Legacy MP webhook support — kept for backward compatibility */
  async processWebhookPayload(_body: Record<string, unknown>): Promise<void> {
    // MP webhook is deprecated — Stripe handles all new subscriptions
  },
};

// ─── INTERNAL HELPERS ────────────────────────────────────────

async function getOrCreateStripeCustomer(
  stripe: StripeInstance,
  userId: string,
  userEmail: string,
  existingCustomerId: string | null,
): Promise<string> {
  if (existingCustomerId) {
    // Verify the customer still exists in Stripe
    try {
      const customer = await stripe.customers.retrieve(existingCustomerId);
      if (!customer.deleted) return existingCustomerId;
    } catch {
      // Customer not found, create a new one
    }
  }

  // Search by metadata first to avoid duplicates
  const list = await stripe.customers.list({ email: userEmail, limit: 5 });
  const match = list.data.find((c: any) => c.metadata?.userId === userId);
  if (match) return match.id;

  const created = await stripe.customers.create({
    email: userEmail,
    metadata: { userId },
  });

  return created.id;
}

function normalizeStatus(rawStatus: unknown): CanonicalSubscriptionStatus {
  const s = typeof rawStatus === 'string' ? rawStatus.trim().toLowerCase() : '';
  if (['active', 'authorized', 'approved', 'trialing', 'in_trial'].includes(s)) return 'active';
  if (['past_due'].includes(s)) return 'past_due';
  if (['pending', 'in_process', 'incomplete'].includes(s)) return 'pending';
  if (['paused', 'suspended'].includes(s)) return 'paused';
  if (['cancelled', 'canceled', 'expired', 'ended', 'unpaid'].includes(s)) return 'cancelled';
  return 'inactive';
}

