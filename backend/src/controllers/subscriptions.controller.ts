import { z } from 'zod';
import { Request, Response } from 'express';
import { subscriptionService } from '../modules/subscriptions/subscription.service';
import { webhookIntakeService } from '../modules/webhooks/webhook-intake.service';

const checkoutSchema = z.object({ planId: z.string().min(1) });
const changePlanSchema = z.object({ planId: z.string().min(1) });

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
};

