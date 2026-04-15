import { MercadoPagoConfig } from 'mercadopago';

let client: MercadoPagoConfig | null = null;

export function getMercadoPagoClient(): MercadoPagoConfig | null {
  if (client) return client;

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    console.warn('[MercadoPago] MERCADOPAGO_ACCESS_TOKEN not configured — MP features disabled');
    return null;
  }

  client = new MercadoPagoConfig({ accessToken });
  return client;
}
