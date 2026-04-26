import Stripe = require('stripe');

type StripeInstance = InstanceType<typeof Stripe>;

let stripeClient: StripeInstance | null = null;

export function getStripeClient(): StripeInstance | null {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    console.warn('[Stripe] STRIPE_SECRET_KEY not configured — Stripe features disabled');
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stripeClient = new Stripe(secretKey, { apiVersion: '2026-04-22.dahlia' as any });
  return stripeClient;
}
