import { Request, Response } from 'express';
import { waInstanceRepository } from '../modules/whatsapp/whatsapp-instance.repository';
import { webhookIntakeService } from '../modules/webhooks/webhook-intake.service';

export const evolutionWebhookController = {
  async handle(req: Request, res: Response) {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : '';
      if (token !== process.env.WEBHOOK_TOKEN) {
        return res.sendStatus(401);
      }

      const incomingRawBody = Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : JSON.stringify(req.body || {});

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(incomingRawBody || '{}') as Record<string, unknown>;
      } catch {
        return res.sendStatus(400);
      }

      if (!payload.event && typeof req.params.event === 'string' && req.params.event.trim()) {
        payload.event = req.params.event.trim().replace(/-/g, '_').toUpperCase();
      }

      const rawBody = Buffer.from(JSON.stringify(payload));
      const signatureHeader = req.header('x-signature') || req.header('x-webhook-signature') || undefined;
      const timestampHeader = req.header('x-timestamp') || undefined;
      const nonceHeader = req.header('x-nonce') || undefined;
      const sourceIp = req.ip || req.socket.remoteAddress || 'unknown';

      const instanceName = typeof payload.instance === 'string'
        ? payload.instance
        : (payload.instance as Record<string, unknown> | undefined)?.instanceName;

      if (typeof instanceName !== 'string' || !instanceName.trim()) {
        return res.sendStatus(403);
      }

      const instance = await waInstanceRepository.findByInstanceName(instanceName.trim());
      if (!instance) {
        return res.sendStatus(403);
      }

      await webhookIntakeService.intakeEvolution({
        rawBody,
        signatureHeader,
        timestampHeader,
        nonceHeader,
        sourceIp,
        tokenValidated: true,
      });

      return res.sendStatus(200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro interno';
      console.error('[Evolution Webhook] intake error:', message);
      const httpError = webhookIntakeService.toHttpError(err);
      res.status(httpError.statusCode).json({ error: httpError.message });
    }
  },
};
