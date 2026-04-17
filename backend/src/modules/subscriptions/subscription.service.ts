import { PreApproval } from 'mercadopago';
import { getMercadoPagoClient } from '../../infrastructure/mercadopago';
import { subscriptionRepository } from './subscription.repository';
import { usageRepository, type Usage } from './usage.repository';
import {
  PLANS,
  getPublicPlans,
  isValidPlanId,
  FEATURE_LIMIT_MAP,
  type PlanId,
  type PlanLimits,
  type PublicPlan,
  type SubscriptionFeature,
} from '../../config/plans';
import { getSubscriptionOverride } from '../../config/subscription-overrides';
import { fraudService } from '../../security/fraud.service';

export interface SubscriptionInfo {
  planId: string;
  planName: string;
  status: string;
  currentPeriodEnd: string | null;
  usage: Usage;
  limits: PlanLimits;
}

export const subscriptionService = {
  getPublicPlans(): PublicPlan[] {
    return getPublicPlans();
  },

  async createCheckout(userId: string, userEmail: string, planId: string): Promise<string> {
    if (!isValidPlanId(planId)) {
      throw new Error('Plano inválido');
    }

    const mpClient = getMercadoPagoClient();
    if (!mpClient) {
      throw new Error('MercadoPago não configurado');
    }

    // Keep only one actionable subscription per user.
    // - active: block creating a new checkout
    // - pending: cancel stale pending and create a fresh checkout
    const existing = await subscriptionRepository.findActiveByUserId(userId);
    if (existing?.status === 'active') {
      throw new Error('Você já possui uma assinatura ativa');
    }
    if (existing?.status === 'pending') {
      await subscriptionRepository.updateStatus(existing.id, 'cancelled');
    }

    const plan = PLANS[planId];
    const preApproval = new PreApproval(mpClient);
    const externalReference = buildExternalReference(userId, planId);

    const response = await preApproval.create({
      body: {
        reason: `Closr — Plano ${plan.name}`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: plan.price_brl / 100,
          currency_id: 'BRL',
        },
        payer_email: userEmail,
        external_reference: externalReference,
        back_url: process.env.MP_SUCCESS_URL || 'http://localhost:5173/home?subscribed=true',
        status: 'pending',
      },
    });

    const initPoint = response.init_point;
    if (!initPoint) {
      throw new Error('MercadoPago não retornou URL de checkout');
    }

    // Save pending subscription
    try {
      await subscriptionRepository.create({
        userId,
        planId,
        status: 'pending',
        mpSubscriptionId: response.id ? String(response.id) : undefined,
      });
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new Error('Já existe um checkout em andamento. Tente novamente em alguns segundos.');
      }
      throw err;
    }

    return initPoint;
  },

  async processWebhookPayload(body: Record<string, unknown>): Promise<void> {
    const type = body.type as string | undefined;
    const action = body.action as string | undefined;
    const data = body.data as Record<string, unknown> | undefined;
    const dataId = data?.id as string | undefined;

    if (!type || !dataId) {
      return; // Ignore unrecognized events
    }

    if (type === 'subscription_preapproval') {
      await handlePreapprovalEvent(action, dataId);
    } else if (type === 'payment') {
      await handlePaymentEvent(dataId);
    }
  },

  async getMySubscription(userId: string): Promise<SubscriptionInfo | null> {
    const override = getSubscriptionOverride(userId);
    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub && override?.forceStatus !== 'active') return null;

    const effectivePlanId = override?.planId ?? sub?.planId ?? 'pro';
    const planId = isValidPlanId(effectivePlanId) ? effectivePlanId : null;
    if (!planId) return null;

    const plan = PLANS[planId];
    const usage = await usageRepository.getUsageForMonth(userId);
    const effectiveStatus = override?.forceStatus ?? sub?.status ?? 'active';

    return {
      planId,
      planName: plan.name,
      status: effectiveStatus,
      currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
      usage,
      limits: plan.limits,
    };
  },

  async cancelSubscription(userId: string): Promise<void> {
    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub) {
      throw new Error('Nenhuma assinatura ativa');
    }

    // Cancel on MercadoPago if we have a subscription ID
    if (sub.mpSubscriptionId) {
      const mpClient = getMercadoPagoClient();
      if (mpClient) {
        const preApproval = new PreApproval(mpClient);
        await preApproval.update({
          id: sub.mpSubscriptionId,
          body: { status: 'cancelled' },
        });
      }
    }

    await subscriptionRepository.updateStatus(sub.id, 'cancelled');
  },

  async checkLimit(userId: string, feature: SubscriptionFeature): Promise<{
    allowed: boolean;
    used: number;
    limit: number | null;
  }> {
    const override = getSubscriptionOverride(userId);
    if (override?.bypassLimits) {
      return { allowed: true, used: 0, limit: null };
    }

    const sub = await subscriptionRepository.findActiveByUserId(userId);
    const hasForcedActive = override?.forceStatus === 'active';
    const isActive = hasForcedActive || (!!sub && sub.status === 'active');

    if (!isActive) {
      return { allowed: false, used: 0, limit: 0 };
    }

    const effectivePlanId = override?.planId ?? sub?.planId ?? 'pro';
    const planId = isValidPlanId(effectivePlanId) ? effectivePlanId : null;
    if (!planId) {
      return { allowed: false, used: 0, limit: 0 };
    }

    const plan = PLANS[planId];
    const limitKey = FEATURE_LIMIT_MAP[feature];
    const limit = plan.limits[limitKey] as number | null;

    // null = unlimited
    if (limit === null) {
      return { allowed: true, used: 0, limit: null };
    }

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

  async reconcileByMpSubscriptionId(mpSubscriptionId: string): Promise<{
    mpSubscriptionId: string;
    status: string;
    action: 'updated' | 'created';
    userId: string;
    planId: PlanId;
  }> {
    const mpClient = getMercadoPagoClient();
    if (!mpClient) {
      throw new Error('MercadoPago não configurado');
    }

    const preApproval = new PreApproval(mpClient);

    let detail: any;
    try {
      detail = await preApproval.get({ id: mpSubscriptionId });
    } catch {
      throw new Error('Assinatura não encontrada no MercadoPago');
    }

    const parsedRef = parseExternalReference(detail.external_reference);
    if (!parsedRef) {
      throw new Error('Não foi possível reconciliar sem external_reference válido');
    }

    const status = mapMpStatusToLocal(detail.status);
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const periodStart = status === 'active' ? now : undefined;
    const safePeriodEnd = status === 'active' ? periodEnd : undefined;

    const updated = await subscriptionRepository.updateByMpSubscriptionId(mpSubscriptionId, {
      status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: safePeriodEnd,
      mpPayerId: detail.payer_id ? String(detail.payer_id) : undefined,
    });

    if (updated) {
      if (parsedRef && updated.planId !== parsedRef.planId) {
        await fraudService.recordEvent({
          tenantId: updated.userId,
          eventType: 'abrupt_plan_change',
          severity: 'high',
          details: {
            source: 'reconcileByMpSubscriptionId',
            mpSubscriptionId,
            dbPlanId: updated.planId,
            externalRefPlanId: parsedRef.planId,
          },
        });
      }

      return {
        mpSubscriptionId,
        status,
        action: 'updated',
        userId: updated.userId,
        planId: isValidPlanId(updated.planId) ? updated.planId : parsedRef.planId,
      };
    }

    const existing = await subscriptionRepository.findActiveByUserId(parsedRef.userId);
    if (existing) {
      await subscriptionRepository.updateStatus(existing.id, 'cancelled');
    }

    const created = await subscriptionRepository.create({
      userId: parsedRef.userId,
      planId: parsedRef.planId,
      status,
      mpSubscriptionId,
      mpPayerId: detail.payer_id ? String(detail.payer_id) : undefined,
      currentPeriodStart: periodStart,
      currentPeriodEnd: safePeriodEnd,
    });

    return {
      mpSubscriptionId,
      status,
      action: 'created',
      userId: created.userId,
      planId: parsedRef.planId,
    };
  },
};

async function handlePreapprovalEvent(action: string | undefined, preapprovalId: string): Promise<void> {
  const mpClient = getMercadoPagoClient();
  if (!mpClient) return;

  const preApproval = new PreApproval(mpClient);

  try {
    const detail = await preApproval.get({ id: preapprovalId });
    const mpStatus = detail.status;
    const parsedRef = parseExternalReference(detail.external_reference);

    if (mpStatus === 'authorized') {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const updated = await subscriptionRepository.updateByMpSubscriptionId(preapprovalId, {
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        mpPayerId: detail.payer_id ? String(detail.payer_id) : undefined,
      });

      if (!updated && parsedRef) {
        const existing = await subscriptionRepository.findActiveByUserId(parsedRef.userId);
        if (existing) {
          if (existing.planId !== parsedRef.planId) {
            await fraudService.recordEvent({
              tenantId: parsedRef.userId,
              eventType: 'abrupt_plan_change',
              severity: 'high',
              details: {
                source: 'handlePreapprovalEvent',
                mpSubscriptionId: preapprovalId,
                oldPlanId: existing.planId,
                newPlanId: parsedRef.planId,
              },
            });
          }
          await subscriptionRepository.updateStatus(existing.id, 'cancelled');
        }

        await subscriptionRepository.create({
          userId: parsedRef.userId,
          planId: parsedRef.planId,
          status: 'active',
          mpSubscriptionId: preapprovalId,
          mpPayerId: detail.payer_id ? String(detail.payer_id) : undefined,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        });
      }
    } else if (mpStatus === 'cancelled') {
      const updated = await subscriptionRepository.updateByMpSubscriptionId(preapprovalId, {
        status: 'cancelled',
      });

      if (!updated && parsedRef) {
        const existing = await subscriptionRepository.findActiveByUserId(parsedRef.userId);
        if (existing) {
          await subscriptionRepository.updateStatus(existing.id, 'cancelled');
        }
      }
    } else if (mpStatus === 'paused') {
      const updated = await subscriptionRepository.updateByMpSubscriptionId(preapprovalId, {
        status: 'paused',
      });

      if (!updated && parsedRef) {
        const existing = await subscriptionRepository.findActiveByUserId(parsedRef.userId);
        if (existing) {
          await subscriptionRepository.updateStatus(existing.id, 'paused');
        }
      }
    }
  } catch (err: any) {
    console.error('[Subscriptions] Error fetching preapproval detail:', err.message);
  }
}

async function handlePaymentEvent(paymentId: string): Promise<void> {
  // Payment events can confirm subscription is active or flag issues
  // For now, we rely on preapproval events for status changes
  console.log('[Subscriptions] Payment event received:', paymentId);
}

function buildExternalReference(userId: string, planId: PlanId): string {
  return `closr:${userId}:${planId}`;
}

function parseExternalReference(value: unknown): { userId: string; planId: PlanId } | null {
  if (typeof value !== 'string') return null;

  const parts = value.split(':');
  if (parts.length !== 3 || parts[0] !== 'closr') return null;

  const userId = parts[1];
  const planIdRaw = parts[2];
  if (!isValidPlanId(planIdRaw)) return null;

  return { userId, planId: planIdRaw };
}

function mapMpStatusToLocal(mpStatus: unknown): 'active' | 'pending' | 'paused' | 'cancelled' {
  if (mpStatus === 'authorized') return 'active';
  if (mpStatus === 'paused') return 'paused';
  if (mpStatus === 'cancelled') return 'cancelled';
  return 'pending';
}
