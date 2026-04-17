import { subscriptionService } from '../subscriptions/subscription.service';
import { waInstanceRepository } from '../whatsapp/whatsapp-instance.repository';

export const webhookProcessorService = {
  async process(provider: 'mercadopago' | 'evolution', payload: Record<string, unknown>): Promise<void> {
    if (provider === 'mercadopago') {
      await subscriptionService.processWebhookPayload(payload);
      return;
    }

    await processEvolutionPayload(payload);
  },
};

async function processEvolutionPayload(payload: Record<string, unknown>): Promise<void> {
  const event = payload.event;
  const instance = payload.instance;
  const data = payload.data;

  const instanceName = typeof instance === 'string'
    ? instance
    : (instance as Record<string, unknown> | undefined)?.instanceName;

  if (typeof instanceName !== 'string' || instanceName.length === 0) {
    return;
  }

  const waInstance = await waInstanceRepository.findByInstanceName(instanceName);
  if (!waInstance) {
    return;
  }

  if (event === 'connection.update') {
    const obj = (data as Record<string, unknown> | undefined) ?? {};
    const state = typeof obj.state === 'string'
      ? obj.state
      : (typeof obj.status === 'string' ? obj.status : '');
    const wid = typeof obj.wid === 'string' ? obj.wid : '';
    const phone = wid.replace(/@.*$/, '') || null;

    const status = state === 'open'
      ? 'connected'
      : state === 'connecting'
        ? 'connecting'
        : 'disconnected';

    await waInstanceRepository.updateStatus(instanceName, status, phone || undefined);
    if (status === 'connected') {
      await waInstanceRepository.clearQrCode(waInstance.tenantId);
    }
    return;
  }

  if (event === 'qrcode.updated') {
    const obj = (data as Record<string, unknown> | undefined) ?? {};
    const qrCode = typeof obj.qrcode === 'string'
      ? obj.qrcode
      : (typeof obj.base64 === 'string' ? obj.base64 : '');

    if (qrCode) {
      await waInstanceRepository.setQrCode(waInstance.tenantId, qrCode);
    }
  }
}
