import { Request, Response } from 'express';
import { waInstanceRepository } from '../modules/whatsapp/whatsapp-instance.repository';
import { evolutionService } from '../services/evolution.service';

function isAlreadyInUseError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return message.includes('already in use') || message.includes('name') && message.includes('in use');
}

export const waInstanceController = {
  /** GET /whatsapp/instance — status da instância do tenant */
  async getStatus(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId!;
      const instance = await waInstanceRepository.findByTenant(tenantId);

      if (!instance) {
        return res.json({ status: 'not_created', phone: null, instanceName: null });
      }

      // Check live status from Evolution API
      let liveStatus: string;
      try {
        liveStatus = await evolutionService.getInstanceStatus(instance.instanceName);
      } catch {
        liveStatus = 'close';
      }

      const mappedStatus = liveStatus === 'open' ? 'connected' as const
        : liveStatus === 'connecting' ? 'connecting' as const
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
      res.status(500).json({ error: 'Erro ao verificar status do WhatsApp' });
    }
  },

  /** POST /whatsapp/connect — criar instância + gerar QR */
  async connect(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId!;
      const instanceName = `user_${tenantId}`;

      let instance = await waInstanceRepository.findByTenant(tenantId);
      let qrCode: string | undefined;

      if (!instance) {
        // First time: create instance on Evolution API.
        // If name is already in use remotely, fallback to connect existing instance.
        try {
          const result = await evolutionService.createInstance(instanceName);
          qrCode = result.qrCode;
        } catch (err: unknown) {
          if (!isAlreadyInUseError(err)) {
            throw err;
          }

          const result = await evolutionService.connectInstance(instanceName);
          qrCode = result.qrCode;
        }
        instance = await waInstanceRepository.upsert(tenantId, { status: 'connecting' });
      } else if (instance.status === 'connected') {
        return res.json({ status: 'already_connected', phone: instance.phone });
      } else {
        // Reconnection
        try {
          const result = await evolutionService.connectInstance(instanceName);
          qrCode = result.qrCode;
        } catch {
          // Instance may not exist on Evolution anymore, recreate
          const result = await evolutionService.createInstance(instanceName);
          qrCode = result.qrCode;
        }
        await waInstanceRepository.updateStatus(instanceName, 'connecting');
      }

      if (qrCode) {
        await waInstanceRepository.setQrCode(tenantId, qrCode);
      }

      return res.json({ status: 'connecting', qrCode });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[WA Instance] connect error:', message);
      res.status(500).json({ error: 'Erro ao conectar WhatsApp' });
    }
  },

  /** POST /whatsapp/disconnect — desconectar instância */
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
        // Instance might already be gone on Evolution — that's fine
      }

      // Remove local record to avoid stale local-vs-remote conflicts.
      await waInstanceRepository.deleteByTenant(tenantId);

      return res.json({ status: 'disconnected' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[WA Instance] disconnect error:', message);
      res.status(500).json({ error: 'Erro ao desconectar WhatsApp' });
    }
  },
};
