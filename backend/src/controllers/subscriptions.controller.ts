import { z } from 'zod';
import { Request, Response } from 'express';
import { subscriptionService } from '../modules/subscriptions/subscription.service';
import { webhookIntakeService } from '../modules/webhooks/webhook-intake.service';
import { webhookRecoveryService } from '../modules/webhooks/webhook-recovery.service';

const checkoutSchema = z.object({ planId: z.string().min(1) });
const changePlanSchema = z.object({ planId: z.string().min(1) });
const webhookReplaySchema = z.object({
  provider: z.enum(['stripe', 'mercadopago', 'evolution']),
  eventId: z.string().min(3),
});
const webhookReplayStaleSchema = z.object({
  provider: z.enum(['stripe', 'mercadopago', 'evolution']).optional(),
  olderThanMinutes: z.number().int().min(0).max(24 * 60).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});
const stripeReconcileSchema = z.object({
  stripeSubscriptionId: z.string().min(3),
});

function ensureOwner(req: Request, res: Response): boolean {
  if (req.authUser?.role !== 'owner') {
    res.status(403).json({ error: 'Acesso restrito a owner.' });
    return false;
  }
  return true;
}

export const subscriptionsController = {
  // GET /api/subscriptions/plans — public
  async getPlans(_req: Request, res: Response): Promise<void> {
    try {
      const plans = subscriptionService.getPublicPlans();
      res.json({ plans });
    } catch (err: any) {
      console.error('[Subscriptions] getPlans error:', err.message);
      res.status(500).json({ error: 'Erro ao buscar planos' });
    }
  },

  // GET /api/subscriptions/me — authenticated
  async getMe(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.authUser!.userId;
      const subscription = await subscriptionService.getMySubscription(userId);
      res.json({ subscription });
    } catch (err: any) {
      console.error('[Subscriptions] getMe error:', err.message);
      res.status(500).json({ error: 'Erro ao buscar assinatura' });
    }
  },

  // GET /api/subscriptions/billing-history — authenticated
  async getBillingHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.authUser!.userId;
      const invoices = await subscriptionService.getBillingHistory(userId);
      res.json({ invoices });
    } catch (err: any) {
      console.error('[Subscriptions] getBillingHistory error:', err.message);
      res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
  },

  // POST /api/subscriptions/checkout — authenticated
  async checkout(req: Request, res: Response): Promise<void> {
    try {
      const parsed = checkoutSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }

      const userId = req.authUser!.userId;
      const userEmail = req.authUser!.email;
      const url = await subscriptionService.createCheckoutSession(userId, userEmail, parsed.data.planId);
      res.json({ url });
    } catch (err: any) {
      console.error('[Subscriptions] checkout error:', err.message);
      const knownErrors = [
        'Plano inválido',
        'Stripe não configurado',
        'Price ID do Stripe não configurado para este plano',
        'Você já possui uma assinatura ativa. Use a opção de troca de plano.',
      ];
      if (knownErrors.includes(err.message)) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao criar checkout' });
    }
  },

  // POST /api/subscriptions/billing-portal — authenticated
  async billingPortal(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.authUser!.userId;
      const url = await subscriptionService.createBillingPortalSession(userId);
      res.json({ url });
    } catch (err: any) {
      console.error('[Subscriptions] billingPortal error:', err.message);
      if (err.message === 'Nenhum perfil de cobrança encontrado') {
        res.status(404).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao abrir portal de cobrança' });
    }
  },

  // POST /api/subscriptions/change-plan — authenticated
  async changePlan(req: Request, res: Response): Promise<void> {
    try {
      const parsed = changePlanSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }

      const userId = req.authUser!.userId;
      const result = await subscriptionService.changePlan(userId, parsed.data.planId);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error('[Subscriptions] changePlan error:', err.message);
      const known = [
        'Plano inválido',
        'Nenhuma assinatura ativa com Stripe',
        'Você já está neste plano',
        'Price ID do Stripe não configurado',
        'Stripe não configurado',
      ];
      if (known.includes(err.message)) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao trocar plano' });
    }
  },

  // POST /api/subscriptions/cancel — authenticated
  async cancel(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.authUser!.userId;
      await subscriptionService.cancelSubscription(userId);
      res.json({ success: true, message: 'Assinatura cancelada ao fim do ciclo atual.' });
    } catch (err: any) {
      console.error('[Subscriptions] cancel error:', err.message);
      if (err.message === 'Nenhuma assinatura ativa') {
        res.status(404).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao cancelar assinatura' });
    }
  },

  // POST /api/subscriptions/reactivate — authenticated
  async reactivate(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.authUser!.userId;
      await subscriptionService.reactivateSubscription(userId);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Subscriptions] reactivate error:', err.message);
      const known = ['Nenhuma assinatura Stripe encontrada', 'Assinatura não está agendada para cancelamento', 'Stripe não configurado'];
      if (known.includes(err.message)) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao reativar assinatura' });
    }
  },

  // POST /api/webhooks/mercadopago — public (legacy — kept for existing MP subscribers)
  async mercadopagoWebhook(req: Request, res: Response): Promise<void> {
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
      const signature = req.headers['x-signature'] as string | undefined;
      const sourceIp = req.ip || req.socket.remoteAddress || 'unknown';

      const intake = await webhookIntakeService.intakeMercadoPago({ rawBody, signatureHeader: signature, sourceIp });
      res.status(202).json({ ok: true, accepted: intake.accepted, duplicate: intake.duplicate });
    } catch (err: any) {
      console.error('[Subscriptions] MP webhook error:', err.message);
      const httpError = webhookIntakeService.toHttpError(err);
      res.status(httpError.statusCode).json({ error: httpError.message });
    }
  },

  // POST /api/webhooks/stripe — public
  async stripeWebhook(req: Request, res: Response): Promise<void> {
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
      const signature = req.headers['stripe-signature'] as string | undefined;

      const intake = await webhookIntakeService.intakeStripe({ rawBody, signatureHeader: signature });
      res.status(200).json({ ok: true, accepted: intake.accepted, duplicate: intake.duplicate });
    } catch (err: any) {
      console.error('[Stripe] webhook intake error:', err.message);
      const httpError = webhookIntakeService.toHttpError(err);
      res.status(httpError.statusCode).json({ error: httpError.message });
    }
  },

  // GET /api/subscriptions/webhooks/health — owner only
  async getWebhookHealth(req: Request, res: Response): Promise<void> {
    if (!ensureOwner(req, res)) return;

    try {
      const providerRaw = typeof req.query.provider === 'string' ? req.query.provider : '';
      const provider = providerRaw ? webhookRecoveryService.parseProvider(providerRaw) : undefined;
      const health = await webhookRecoveryService.getHealth(provider);
      res.json({ health });
    } catch (err: any) {
      console.error('[Subscriptions] getWebhookHealth error:', err.message);
      res.status(400).json({ error: err.message || 'Erro ao obter saúde dos webhooks' });
    }
  },

  // POST /api/subscriptions/webhooks/replay — owner only
  async replayWebhook(req: Request, res: Response): Promise<void> {
    if (!ensureOwner(req, res)) return;

    const parsed = webhookReplaySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    try {
      const replayed = await webhookRecoveryService.replayByProviderEventId(parsed.data.provider, parsed.data.eventId);
      res.json({ success: true, replayed });
    } catch (err: any) {
      console.error('[Subscriptions] replayWebhook error:', err.message);
      res.status(500).json({ error: 'Erro ao reenfileirar webhook' });
    }
  },

  // POST /api/subscriptions/webhooks/replay-stale — owner only
  async replayStaleWebhooks(req: Request, res: Response): Promise<void> {
    if (!ensureOwner(req, res)) return;

    const parsed = webhookReplayStaleSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    try {
      const replay = await webhookRecoveryService.replayStale({
        provider: parsed.data.provider,
        olderThanMinutes: parsed.data.olderThanMinutes,
        limit: parsed.data.limit,
        statuses: ['pending', 'failed'],
      });
      res.json({ success: true, ...replay });
    } catch (err: any) {
      console.error('[Subscriptions] replayStaleWebhooks error:', err.message);
      res.status(500).json({ error: 'Erro ao reenfileirar webhooks pendentes/falhos' });
    }
  },

  // POST /api/subscriptions/stripe/reconcile — owner only
  async reconcileStripeSubscription(req: Request, res: Response): Promise<void> {
    if (!ensureOwner(req, res)) return;

    const parsed = stripeReconcileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    try {
      const refreshed = await subscriptionService.refreshStripeSubscriptionFromProvider(parsed.data.stripeSubscriptionId);
      res.json({ success: true, refreshed });
    } catch (err: any) {
      console.error('[Subscriptions] reconcileStripeSubscription error:', err.message);
      res.status(500).json({ error: 'Erro ao reconciliar assinatura Stripe' });
    }
  },
};

