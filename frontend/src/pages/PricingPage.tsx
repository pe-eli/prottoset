import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { subscriptionsAPI, type PublicPlan } from '../features/subscriptions/subscriptions.api';
import { useSubscription } from '../contexts/useSubscription';

interface ApiErrorPayload {
  error?: string;
}

function formatPlanPrice(plan: PublicPlan): string {
  if (typeof plan.price === 'string' && plan.price.trim()) {
    return plan.price;
  }

  const monthly = Number(plan.price_monthly);
  if (Number.isFinite(monthly)) {
    return monthly.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  return 'Preco indisponivel';
}

const CheckIcon = () => (
  <svg className="w-4 h-4 text-mint flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

export function PricingPage() {
  const [searchParams] = useSearchParams();
  const { subscription, refresh } = useSubscription();
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check for return from MP checkout
  useEffect(() => {
    if (searchParams.get('subscribed') === 'true') {
      refresh();
    }
  }, [searchParams, refresh]);

  useEffect(() => {
    subscriptionsAPI
      .getPlans()
      .then(({ data }) => setPlans(data.plans))
      .catch((err: unknown) => {
        const apiError = isAxiosError<ApiErrorPayload>(err) ? err.response?.data?.error : undefined;
        setError(apiError || 'Erro ao carregar planos');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const resetCheckoutState = () => {
      setCheckoutLoading(null);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetCheckoutState();
      }
    };

    // Browsers can restore this page from bfcache after external checkout.
    // Ensure CTA buttons are re-enabled when the user comes back.
    resetCheckoutState();
    window.addEventListener('pageshow', resetCheckoutState);
    window.addEventListener('focus', resetCheckoutState);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pageshow', resetCheckoutState);
      window.removeEventListener('focus', resetCheckoutState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleCheckout = async (planId: string) => {
    try {
      setCheckoutLoading(planId);
      setError(null);
      const { data } = await subscriptionsAPI.checkout(planId);
      window.location.assign(data.url);
    } catch (err: unknown) {
      const apiError = isAxiosError<ApiErrorPayload>(err) ? err.response?.data?.error : undefined;
      setError(apiError || 'Erro ao iniciar checkout');
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="mx-auto h-9 w-9 rounded-full border-2 border-border border-t-brand-400 animate-spin" />
          <p className="mt-3 text-sm text-text-secondary">Carregando planos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-16">
      {/* Glow */}
      <div
        className="fixed left-1/2 top-0 -translate-x-1/2 w-[800px] h-[500px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, rgba(123,140,222,0.10) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h1
            className="text-3xl md:text-4xl font-heading font-extrabold mb-3"
            style={{
              background: 'linear-gradient(to bottom, #e8eaf0, rgba(232,234,240,0.6))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.03em',
            }}
          >
            Escolha seu plano
          </h1>
          <p className="text-text-muted max-w-md mx-auto">
            Comece a prospectar, disparar mensagens e fechar negócios hoje mesmo.
          </p>
        </div>

        {error && (
          <div className="mb-8 mx-auto max-w-md rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isRecommended = plan.id === 'agencia';
            const isCurrent = subscription?.planId === plan.id && subscription?.status === 'active';

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-7 flex flex-col transition-all duration-300 ${
                  isRecommended
                    ? 'border-brand-400/40 bg-gradient-to-b from-surface to-surface-elevated shadow-xl shadow-brand-400/5 scale-[1.02]'
                    : 'border-border bg-surface hover:border-border-light'
                }`}
              >
                {isRecommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-brand-400 text-white text-xs font-bold">
                    Recomendado
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute -top-3 right-4 px-3 py-1 rounded-full bg-mint/20 border border-mint/30 text-mint text-xs font-bold">
                    Plano atual
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-heading font-bold text-text-primary mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-heading font-extrabold text-brand-400">{formatPlanPrice(plan)}</span>
                    <span className="text-sm text-text-muted">/mês</span>
                  </div>
                </div>

                <ul className="flex-1 space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <CheckIcon />
                      <span className="text-sm text-text-secondary">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button
                    type="button"
                    disabled
                    className="w-full h-11 rounded-xl text-sm font-semibold bg-surface-elevated border border-border text-text-muted cursor-not-allowed"
                  >
                    Plano ativo
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCheckout(plan.id)}
                    disabled={checkoutLoading !== null}
                    className={`w-full h-11 rounded-xl text-sm font-semibold transition-all active:scale-95 cursor-pointer ${
                      isRecommended
                        ? 'bg-brand-400 text-white hover:bg-brand-500 shadow-lg shadow-brand-400/20'
                        : 'bg-surface-elevated border border-border-light text-text-primary hover:border-brand-400/30 hover:text-brand-400'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {checkoutLoading === plan.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        Redirecionando...
                      </span>
                    ) : (
                      'Assinar'
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-text-muted mt-10">
          Pagamento seguro via MercadoPago. Cancele quando quiser.
        </p>
      </div>
    </div>
  );
}
