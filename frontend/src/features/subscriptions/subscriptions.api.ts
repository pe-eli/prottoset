import { api } from '../../lib/axios';

export interface PlanLimits {
  leads_per_month: number | null;
  whatsapp_messages: number | null;
  emails_per_month: number | null;
  pdf_quotes: number | null;
  ai_credits: number | null;
  seats: number;
}

export interface PublicPlan {
  id: string;
  name: string;
  price: string;
  price_monthly: number;
  limits: PlanLimits;
  features: string[];
}

export interface Usage {
  leadsUsed: number;
  whatsappUsed: number;
  emailsUsed: number;
  quotesUsed: number;
  aiCreditsUsed: number;
}

export interface SubscriptionInfo {
  planId: string;
  planName: string;
  status: string;
  currentPeriodEnd: string | null;
  usage: Usage;
  limits: PlanLimits;
}

export const subscriptionsAPI = {
  getPlans: () => api.get<{ plans: PublicPlan[] }>('/subscriptions/plans'),
  checkout: (planId: string) => api.post<{ url: string }>('/subscriptions/checkout', { planId }),
  getMe: () => api.get<{ subscription: SubscriptionInfo | null }>('/subscriptions/me'),
  cancel: () => api.post('/subscriptions/cancel'),
};
