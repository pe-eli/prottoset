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
  cancelAtPeriodEnd: boolean;
  scheduledPlan: string | null;
  usage: Usage;
  limits: PlanLimits;
}

export interface Invoice {
  id: string;
  stripeInvoiceId: string;
  amount: number; // centavos
  currency: string;
  status: string;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  paidAt: string | null;
  createdAt: string;
}

export const subscriptionsAPI = {
  getPlans: () => api.get<{ plans: PublicPlan[] }>('/subscriptions/plans'),
  getMe: () => api.get<{ subscription: SubscriptionInfo | null }>('/subscriptions/me'),
  getBillingHistory: () => api.get<{ invoices: Invoice[] }>('/subscriptions/billing-history'),
  checkout: (planId: string) => api.post<{ url: string }>('/subscriptions/checkout', { planId }),
  changePlan: (planId: string) => api.post<{ success: boolean; immediate: boolean; effectiveAt: string | null }>('/subscriptions/change-plan', { planId }),
  cancel: () => api.post('/subscriptions/cancel'),
  reactivate: () => api.post('/subscriptions/reactivate'),
  getBillingPortalUrl: () => api.post<{ url: string }>('/subscriptions/billing-portal'),
};
