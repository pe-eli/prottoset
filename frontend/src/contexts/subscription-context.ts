import { createContext } from 'react';
import type { SubscriptionInfo } from '../features/subscriptions/subscriptions.api';

export type PaywallReason = 'subscription_required' | 'limit_exceeded';

export interface SubscriptionContextValue {
  subscription: SubscriptionInfo | null;
  loading: boolean;
  showPaywall: boolean;
  paywallReason: PaywallReason | null;
  openPaywall: (reason: PaywallReason) => void;
  closePaywall: () => void;
  refresh: () => Promise<void>;
}

export const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  loading: true,
  showPaywall: false,
  paywallReason: null,
  openPaywall: () => {},
  closePaywall: () => {},
  refresh: async () => {},
});
