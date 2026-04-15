import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { subscriptionsAPI, type SubscriptionInfo } from '../features/subscriptions/subscriptions.api';

type PaywallReason = 'subscription_required' | 'limit_exceeded';

interface SubscriptionContextValue {
  subscription: SubscriptionInfo | null;
  loading: boolean;
  showPaywall: boolean;
  paywallReason: PaywallReason | null;
  openPaywall: (reason: PaywallReason) => void;
  closePaywall: () => void;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  loading: true,
  showPaywall: false,
  paywallReason: null,
  openPaywall: () => {},
  closePaywall: () => {},
  refresh: async () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState<PaywallReason | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      const { data } = await subscriptionsAPI.getMe();
      setSubscription(data.subscription);
    } catch {
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const openPaywall = useCallback((reason: PaywallReason) => {
    setPaywallReason(reason);
    setShowPaywall(true);
  }, []);

  const closePaywall = useCallback(() => {
    setShowPaywall(false);
    setPaywallReason(null);
  }, []);

  // Listen for 402 events from the Axios interceptor
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      openPaywall(detail?.code === 'limit_exceeded' ? 'limit_exceeded' : 'subscription_required');
    };
    window.addEventListener('subscription:paywall', handler);
    return () => window.removeEventListener('subscription:paywall', handler);
  }, [openPaywall]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        showPaywall,
        paywallReason,
        openPaywall,
        closePaywall,
        refresh: fetchSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
