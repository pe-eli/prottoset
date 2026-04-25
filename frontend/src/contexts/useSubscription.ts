import { useContext } from 'react';
import { SubscriptionContext } from './subscription-context';

export function useSubscription() {
  return useContext(SubscriptionContext);
}
