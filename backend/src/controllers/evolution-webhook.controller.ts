import { Request, Response } from 'express';
import { waInstanceRepository } from '../modules/whatsapp/whatsapp-instance.repository';

export const evolutionWebhookController = {
  async handle(req: Request, res: Response) {
    // Respond 200 immediately — Evolution API expects fast response
    res.sendStatus(200);

    try {
      const { event, instance, data } = req.body;
      const instanceName: string | undefined =
        typeof instance === 'string' ? instance : instance?.instanceName;

      if (!instanceName) return;

      // Map instanceName → tenant
      const waInstance = await waInstanceRepository.findByInstanceName(instanceName);
      if (!waInstance) {
        console.warn(`[Evolution Webhook] Unknown instance: ${instanceName}`);
        return;
      }

      switch (event) {
        case 'connection.update': {
          const state: string = data?.state ?? data?.status ?? '';
          const wid: string = data?.wid ?? '';
          const phone = wid.replace(/@.*$/, '') || null;

          const status = state === 'open' ? 'connected' as const
            : state === 'connecting' ? 'connecting' as const
            : 'disconnected' as const;

          await waInstanceRepository.updateStatus(instanceName, status, phone || undefined);

          if (status === 'connected') {
            await waInstanceRepository.clearQrCode(waInstance.tenantId);
          }

          console.log(`[Evolution Webhook] ${instanceName} → ${status} (phone: ${phone})`);
          break;
        }

        case 'qrcode.updated': {
          const qrCode: string | undefined = data?.qrcode ?? data?.base64;
          if (qrCode) {
            await waInstanceRepository.setQrCode(waInstance.tenantId, qrCode);
            console.log(`[Evolution Webhook] QR updated for ${instanceName}`);
          }
          break;
        }

        case 'messages.upsert': {
          // Incoming messages — can be used for tracking in the future
          console.log(`[Evolution Webhook] Message received on ${instanceName} (tenant: ${waInstance.tenantId})`);
          break;
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Evolution Webhook] Error processing event:', message);
    }
  },
};
