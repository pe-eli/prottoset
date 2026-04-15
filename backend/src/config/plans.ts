export type PlanId = 'solo' | 'agencia' | 'pro';

export type SubscriptionFeature = 'leads' | 'whatsapp' | 'emails' | 'quotes';

export interface PlanLimits {
  leads_per_month: number | null;
  whatsapp_messages: number | null;
  emails_per_month: number | null;
  pdf_quotes: number | null;
  seats: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  price_brl: number; // centavos
  mercadopago_plan_id: string;
  limits: PlanLimits;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  solo: {
    id: 'solo',
    name: 'Solo',
    price_brl: 19700,
    mercadopago_plan_id: process.env.MP_PLAN_ID_SOLO || 'MP_PLAN_ID_SOLO',
    limits: {
      leads_per_month: 300,
      whatsapp_messages: 150,
      emails_per_month: 500,
      pdf_quotes: 20,
      seats: 1,
    },
    features: [
      '300 leads por mês',
      '150 mensagens WhatsApp',
      '500 e-mails por mês',
      '20 orçamentos PDF',
      'Histórico de contatos',
    ],
  },
  agencia: {
    id: 'agencia',
    name: 'Agência',
    price_brl: 39700,
    mercadopago_plan_id: process.env.MP_PLAN_ID_AGENCIA || 'MP_PLAN_ID_AGENCIA',
    limits: {
      leads_per_month: 1500,
      whatsapp_messages: 800,
      emails_per_month: 5000,
      pdf_quotes: 100,
      seats: 3,
    },
    features: [
      '1.500 leads por mês',
      '800 mensagens WhatsApp',
      '5.000 e-mails por mês',
      '100 orçamentos PDF',
      'Até 3 usuários',
      'Histórico de contatos',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price_brl: 79700,
    mercadopago_plan_id: process.env.MP_PLAN_ID_PRO || 'MP_PLAN_ID_PRO',
    limits: {
      leads_per_month: null,
      whatsapp_messages: null,
      emails_per_month: null,
      pdf_quotes: null,
      seats: 10,
    },
    features: [
      'Leads ilimitados',
      'Mensagens ilimitadas',
      'E-mails ilimitados',
      'Orçamentos ilimitados',
      'Até 10 usuários',
      'Acesso via API',
    ],
  },
};

const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export function isValidPlanId(id: string): id is PlanId {
  return PLAN_IDS.includes(id as PlanId);
}

export interface PublicPlan {
  id: PlanId;
  name: string;
  price: string;
  price_monthly: number;
  limits: PlanLimits;
  features: string[];
}

export function getPublicPlans(): PublicPlan[] {
  return PLAN_IDS.map((id) => {
    const plan = PLANS[id];
    return {
      id: plan.id,
      name: plan.name,
      price: formatBRL(plan.price_brl),
      price_monthly: plan.price_brl / 100,
      limits: plan.limits,
      features: plan.features,
    };
  });
}

function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Map subscription feature to its limit key in PlanLimits */
export const FEATURE_LIMIT_MAP: Record<SubscriptionFeature, keyof PlanLimits> = {
  leads: 'leads_per_month',
  whatsapp: 'whatsapp_messages',
  emails: 'emails_per_month',
  quotes: 'pdf_quotes',
};

/** Map subscription feature to its usage column in subscription_usage table */
export const FEATURE_USAGE_COLUMN: Record<SubscriptionFeature, string> = {
  leads: 'leads_used',
  whatsapp: 'whatsapp_used',
  emails: 'emails_used',
  quotes: 'quotes_used',
};
