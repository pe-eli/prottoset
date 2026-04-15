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
import crypto from 'crypto';

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

    const plan = PLANS[planId];
    const preApproval = new PreApproval(mpClient);

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
        back_url: process.env.MP_SUCCESS_URL || 'http://localhost:5173/home?subscribed=true',
        status: 'pending',
      },
    });

    const initPoint = response.init_point;
    if (!initPoint) {
      throw new Error('MercadoPago não retornou URL de checkout');
    }

    // Save pending subscription
    await subscriptionRepository.create({
      userId,
      planId,
      status: 'pending',
      mpSubscriptionId: response.id ? String(response.id) : undefined,
    });

    return initPoint;
  },

  async processWebhook(body: Record<string, unknown>, signatureHeader: string | undefined): Promise<void> {
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();

    // Validate signature if secret is configured
    if (webhookSecret && signatureHeader) {
      const isValid = validateWebhookSignature(signatureHeader, body, webhookSecret);
      if (!isValid) {
        throw new Error('Assinatura do webhook inválida');
      }
    }

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
    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub) return null;

    const planId = isValidPlanId(sub.planId) ? sub.planId : null;
    if (!planId) return null;

    const plan = PLANS[planId];
    const usage = await usageRepository.getUsageForMonth(userId);

    return {
      planId: sub.planId,
      planName: plan.name,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
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
    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub || sub.status !== 'active') {
      return { allowed: false, used: 0, limit: 0 };
    }

    const planId = isValidPlanId(sub.planId) ? sub.planId : null;
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
    };

    const used = usageMap[feature];
    return { allowed: used < limit, used, limit };
  },
};

async function handlePreapprovalEvent(action: string | undefined, preapprovalId: string): Promise<void> {
  const mpClient = getMercadoPagoClient();
  if (!mpClient) return;

  const preApproval = new PreApproval(mpClient);

  try {
    const detail = await preApproval.get({ id: preapprovalId });
    const mpStatus = detail.status;

    if (mpStatus === 'authorized') {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await subscriptionRepository.updateByMpSubscriptionId(preapprovalId, {
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        mpPayerId: detail.payer_id ? String(detail.payer_id) : undefined,
      });
    } else if (mpStatus === 'cancelled') {
      await subscriptionRepository.updateByMpSubscriptionId(preapprovalId, {
        status: 'cancelled',
      });
    } else if (mpStatus === 'paused') {
      await subscriptionRepository.updateByMpSubscriptionId(preapprovalId, {
        status: 'paused',
      });
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

function validateWebhookSignature(
  signatureHeader: string,
  body: Record<string, unknown>,
  secret: string,
): boolean {
  try {
    // MercadoPago x-signature format: ts=<timestamp>,v1=<hash>
    const parts = signatureHeader.split(',');
    const tsEntry = parts.find((p) => p.startsWith('ts='));
    const v1Entry = parts.find((p) => p.startsWith('v1='));

    if (!tsEntry || !v1Entry) return false;

    const ts = tsEntry.split('=')[1];
    const receivedHash = v1Entry.split('=')[1];

    const data = body.data as Record<string, unknown> | undefined;
    const dataId = data?.id ?? '';

    // Build manifest following MP docs
    const manifest = `id:${dataId};request-id:;ts:${ts};`;
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(receivedHash, 'hex'),
      Buffer.from(expectedHash, 'hex'),
    );
  } catch {
    return false;
  }
}
