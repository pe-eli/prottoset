import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';

export function PaywallModal() {
  const navigate = useNavigate();
  const { showPaywall, paywallReason, closePaywall, subscription } = useSubscription();

  if (!showPaywall) return null;

  const isLimitExceeded = paywallReason === 'limit_exceeded';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-brand-950/30 backdrop-blur-sm animate-fade-in"
        onClick={closePaywall}
      />

      {/* Panel */}
      <div className="relative bg-surface rounded-2xl shadow-2xl border border-border-light animate-slide-up max-w-md w-full p-8">
        {/* Close button */}
        <button
          type="button"
          onClick={closePaywall}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-surface-elevated flex items-center justify-center text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div className="mx-auto w-14 h-14 rounded-xl bg-brand-400/10 border border-brand-400/20 flex items-center justify-center mb-5">
          {isLimitExceeded ? (
            <svg className="w-7 h-7 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ) : (
            <svg className="w-7 h-7 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="text-center">
          <h3 className="text-lg font-heading font-bold text-text-primary mb-2">
            {isLimitExceeded ? 'Limite mensal atingido' : 'Assine para continuar'}
          </h3>
          <p className="text-sm text-text-muted mb-6 leading-relaxed">
            {isLimitExceeded
              ? subscription
                ? `Seu plano ${subscription.planName} atingiu o limite deste mês. Faça upgrade para continuar.`
                : 'Você atingiu o limite de uso deste mês.'
              : 'Esta funcionalidade requer uma assinatura ativa. Escolha um plano para desbloquear todos os recursos do Closr.'
            }
          </p>

          <button
            type="button"
            onClick={() => {
              closePaywall();
              navigate('/pricing');
            }}
            className="w-full h-11 rounded-xl text-sm font-semibold bg-brand-400 text-white hover:bg-brand-500 active:scale-95 transition-all shadow-lg shadow-brand-400/20 cursor-pointer"
          >
            {isLimitExceeded ? 'Fazer upgrade' : 'Ver planos'}
          </button>

          <button
            type="button"
            onClick={closePaywall}
            className="w-full mt-3 h-10 rounded-xl text-sm text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
