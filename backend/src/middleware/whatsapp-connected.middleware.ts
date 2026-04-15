import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { waInstanceRepository } from '../modules/whatsapp/whatsapp-instance.repository';

declare global {
  namespace Express {
    interface Request {
      waInstanceName?: string;
    }
  }
}

/**
 * Blocks the request if the tenant does not have a connected WhatsApp instance.
 * Injects `req.waInstanceName` for downstream handlers.
 */
export function requireConnectedWhatsApp(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const instance = await waInstanceRepository.findByTenant(tenantId);

    if (!instance || instance.status !== 'connected') {
      res.status(422).json({
        error: 'WhatsApp não conectado',
        code: 'WHATSAPP_NOT_CONNECTED',
        message: 'Conecte seu WhatsApp antes de enviar mensagens.',
      });
      return;
    }

    req.waInstanceName = instance.instanceName;
    next();
  };
}
