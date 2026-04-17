import { Request, Response } from 'express';
import { subscriptionService } from '../modules/subscriptions/subscription.service';
import { checkoutSchema, reconcileSubscriptionSchema } from '../validation/request.schemas';
import { webhookIntakeService } from '../modules/webhooks/webhook-intake.service';

export const subscriptionsController = {
  async getPlans(_req: Request, res: Response): Promise<void> {
    try {
      const plans = subscriptionService.getPublicPlans();
      res.json({ plans });
    } catch (err: any) {
      console.error('[Subscriptions] getPlans error:', err.message);
      res.status(500).json({ error: 'Erro ao buscar planos' });
    }
  },

  async checkout(req: Request, res: Response): Promise<void> {
    try {
      const parsed = checkoutSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }

      const userId = req.authUser!.userId;
      const userEmail = req.authUser!.email;
      const url = await subscriptionService.createCheckout(userId, userEmail, parsed.data.planId);
      res.json({ url });
    } catch (err: any) {
      console.error('[Subscriptions] checkout error:', err.message);
      if (
        err.message === 'Plano inválido'
        || err.message === 'MercadoPago não configurado'
        || err.message === 'Você já possui uma assinatura ativa'
        || err.message === 'Já existe um checkout em andamento. Tente novamente em alguns segundos.'
      ) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao criar checkout' });
    }
  },

  async webhook(req: Request, res: Response): Promise<void> {
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
      const signature = req.headers['x-signature'] as string | undefined;
      const sourceIp = req.ip || req.socket.remoteAddress || 'unknown';

      const intake = await webhookIntakeService.intakeMercadoPago({
        rawBody,
        signatureHeader: signature,
        sourceIp,
      });

      res.status(202).json({
        ok: true,
        accepted: intake.accepted,
        duplicate: intake.duplicate,
      });
    } catch (err: any) {
      console.error('[Subscriptions] webhook intake error:', err.message);
      const httpError = webhookIntakeService.toHttpError(err);
      res.status(httpError.statusCode).json({ error: httpError.message });
    }
  },

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

  async cancel(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.authUser!.userId;
      await subscriptionService.cancelSubscription(userId);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Subscriptions] cancel error:', err.message);
      if (err.message === 'Nenhuma assinatura ativa') {
        res.status(404).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao cancelar assinatura' });
    }
  },

  async reconcile(req: Request, res: Response): Promise<void> {
    try {
      if (req.authUser?.role !== 'owner') {
        res.status(403).json({ error: 'Apenas owners podem executar reconciliação manual.' });
        return;
      }

      const parsed = reconcileSubscriptionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }

      const result = await subscriptionService.reconcileByMpSubscriptionId(parsed.data.mpSubscriptionId);
      res.json({ success: true, result });
    } catch (err: any) {
      console.error('[Subscriptions] reconcile error:', err.message);
      if (
        err.message === 'MercadoPago não configurado'
        || err.message === 'Não foi possível reconciliar sem external_reference válido'
      ) {
        res.status(400).json({ error: err.message });
        return;
      }
      if (err.message === 'Assinatura não encontrada no MercadoPago') {
        res.status(404).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao reconciliar assinatura' });
    }
  },
};
