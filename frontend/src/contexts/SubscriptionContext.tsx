import { useCallback, useEffect, useRef, useState } from 'react';
import { subscriptionsAPI, type SubscriptionInfo } from '../features/subscriptions/subscriptions.api';
import { SubscriptionContext, type PaywallReason } from './subscription-context';
const SUBSCRIPTION_REFRESH_INTERVAL_MS = 60_000;
const MIN_REFRESH_GAP_MS = 15_000;

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState<PaywallReason | null>(null);
  const fetchingRef = useRef(false);
  const lastRefreshAtRef = useRef(0);

  const fetchSubscription = useCallback(async (options?: { clearOnError?: boolean; force?: boolean }) => {
    const now = Date.now();
    if (!options?.force && now - lastRefreshAtRef.current < MIN_REFRESH_GAP_MS) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    lastRefreshAtRef.current = now;
    try {
      const { data } = await subscriptionsAPI.getMe();
      setSubscription(data.subscription);
    } catch {
      if (options?.clearOnError) {
        setSubscription(null);
      }
    } finally {
      fetchingRef.current = false;
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
    fetchSubscription({ clearOnError: true, force: true });
  }, [fetchSubscription]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchSubscription();
      }
    };

    const interval = window.setInterval(refreshIfVisible, SUBSCRIPTION_REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
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
