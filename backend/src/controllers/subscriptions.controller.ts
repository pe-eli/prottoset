import { Request, Response } from 'express';
import { subscriptionService } from '../modules/subscriptions/subscription.service';
import { checkoutSchema } from '../validation/request.schemas';

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
      const signature = req.headers['x-signature'] as string | undefined;
      await subscriptionService.processWebhook(req.body, signature);
      res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error('[Subscriptions] webhook error:', err.message);
      // Always return 200 to MP to prevent retries on validation errors
      res.status(200).json({ ok: true });
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
};
