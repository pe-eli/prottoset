import { describe, expect, it } from 'vitest';
import { webhookSecurityService } from './webhook-security.service';

describe('webhookSecurityService', () => {
  it('fails closed when Mercado Pago secret is missing', () => {
    const result = webhookSecurityService.validateMercadoPagoSignature({
      rawBody: '{}',
      signatureHeader: 'ts=1,v1=deadbeef',
      secret: '',
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('missing_webhook_secret');
  });
});
