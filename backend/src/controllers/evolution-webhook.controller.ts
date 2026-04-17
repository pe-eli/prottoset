import { Request, Response } from 'express';
import { webhookIntakeService } from '../modules/webhooks/webhook-intake.service';

export const evolutionWebhookController = {
  async handle(req: Request, res: Response) {
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
      const signatureHeader = req.header('x-signature') || req.header('x-webhook-signature') || undefined;
      const timestampHeader = req.header('x-timestamp') || undefined;
      const nonceHeader = req.header('x-nonce') || undefined;

      const intake = await webhookIntakeService.intakeEvolution({
        rawBody,
        signatureHeader,
        timestampHeader,
        nonceHeader,
        sourceIp: req.ip,
      });

      res.status(202).json({
        ok: true,
        accepted: intake.accepted,
        duplicate: intake.duplicate,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro interno';
      console.error('[Evolution Webhook] intake error:', message);
      const httpError = webhookIntakeService.toHttpError(err);
      res.status(httpError.statusCode).json({ error: httpError.message });
    }
  },
};
