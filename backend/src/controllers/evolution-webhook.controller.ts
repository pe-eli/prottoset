import { Request, Response } from 'express';
import { waInstanceRepository } from '../modules/whatsapp/whatsapp-instance.repository';
import { webhookIntakeService } from '../modules/webhooks/webhook-intake.service';

export const evolutionWebhookController = {
  async handle(req: Request, res: Response) {
    try {
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body || {}));
      const incomingRawBody = rawBody.toString('utf8');

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(incomingRawBody || '{}') as Record<string, unknown>;
      } catch {
        return res.sendStatus(400);
      }

      const eventOverride = typeof req.params.event === 'string' && req.params.event.trim()
        ? req.params.event.trim().replace(/-/g, '_').toUpperCase()
        : undefined;
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
        eventOverride,
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
