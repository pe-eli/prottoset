import { Request, Response } from 'express';
import { waInstanceRepository } from '../modules/whatsapp/whatsapp-instance.repository';
import { evolutionService } from '../services/evolution.service';

function buildProvisionedInstanceName(userId: string): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'tenant';
  return `user_${safeUser}_${Date.now()}`;
}

async function setWebhookWithRetry(instanceName: string, maxAttempts = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await evolutionService.setWebhook(instanceName);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[WA Instance] setWebhook attempt ${attempt}/${maxAttempts} failed for ${instanceName}:`, message);
      if (attempt === maxAttempts) {
        return false;
      }
    }
  }
  return false;
}

async function provisionInstance(userId: string): Promise<{ instanceName: string; qrCode?: string; webhookConfigured: boolean }> {
  const instanceName = buildProvisionedInstanceName(userId);
  const created = await evolutionService.createInstance(instanceName);

  const webhookConfigured = await setWebhookWithRetry(instanceName, 3);
  await waInstanceRepository.upsert(userId, {
    instanceName,
    status: webhookConfigured ? 'created' : 'webhook_pending',
  });

  if (created.qrCode) {
    await waInstanceRepository.setQrCode(userId, created.qrCode);
  }

  return {
    instanceName,
    qrCode: created.qrCode,
    webhookConfigured,
  };
}

export const waInstanceController = {
  async getStatus(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId!;
      const instance = await waInstanceRepository.findByTenant(tenantId);

      if (!instance) {
        return res.json({ status: 'not_created', phone: null, instanceName: null });
      }

      let liveStatus: string;
      try {
        liveStatus = await evolutionService.getInstanceStatus(instance.instanceName);
      } catch {
        liveStatus = 'close';
      }

      const mappedStatus = liveStatus === 'open'
        ? 'connected' as const
        : liveStatus === 'connecting'
          ? 'connecting' as const
          : 'disconnected' as const;

      if (mappedStatus !== instance.status) {
        await waInstanceRepository.updateStatus(instance.instanceName, mappedStatus);
      }

      return res.json({
        status: mappedStatus,
        phone: instance.phone,
        instanceName: instance.instanceName,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[WA Instance] getStatus error:', message);
      return res.status(500).json({ error: 'Erro ao verificar status do WhatsApp' });
    }
  },

  async connect(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId!;

      let instance = await waInstanceRepository.findByTenant(tenantId);
      let qrCode: string | undefined;
      let webhookConfigured = true;

      if (!instance) {
        const provisioned = await provisionInstance(tenantId);
        qrCode = provisioned.qrCode;
        webhookConfigured = provisioned.webhookConfigured;
        instance = await waInstanceRepository.findByTenant(tenantId);
      } else if (instance.status === 'connected') {
        return res.json({ status: 'already_connected', phone: instance.phone });
      } else {
        let targetInstanceName = instance.instanceName;
        try {
          const result = await evolutionService.connectInstance(targetInstanceName);
          qrCode = result.qrCode;
        } catch {
          const provisioned = await provisionInstance(tenantId);
          qrCode = provisioned.qrCode;
          webhookConfigured = provisioned.webhookConfigured;
          targetInstanceName = provisioned.instanceName;
          instance = await waInstanceRepository.findByTenant(tenantId);
        }

        await waInstanceRepository.updateStatus(targetInstanceName, 'connecting');
      }

      if (qrCode && instance) {
        await waInstanceRepository.setQrCode(tenantId, qrCode);
      }

      if (instance && !webhookConfigured) {
        await waInstanceRepository.updateStatus(instance.instanceName, 'webhook_pending');
      }

      return res.json({ status: 'connecting', qrCode, webhookConfigured });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[WA Instance] connect error:', message);
      return res.status(500).json({ error: 'Erro ao conectar WhatsApp' });
    }
  },

  async disconnect(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId!;
      const instance = await waInstanceRepository.findByTenant(tenantId);

      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' });
      }

      try {
        await evolutionService.deleteInstance(instance.instanceName);
      } catch {
        // Instance might already be gone on Evolution.
      }

      await waInstanceRepository.deleteByTenant(tenantId);
      return res.json({ status: 'disconnected' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[WA Instance] disconnect error:', message);
      return res.status(500).json({ error: 'Erro ao desconectar WhatsApp' });
    }
  },
};
