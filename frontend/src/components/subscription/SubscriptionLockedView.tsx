import { Link } from 'react-router-dom';

interface SubscriptionLockedViewProps {
  featureName: string;
  description: string;
}

export function SubscriptionLockedView({ featureName, description }: SubscriptionLockedViewProps) {
  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-6 py-7">
        <div className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m6-6V9a6 6 0 10-12 0v2m12 0H6m12 0a2 2 0 012 2v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5a2 2 0 012-2" />
          </svg>
          Assinatura necessária
        </div>

        <h2 className="mt-4 text-2xl font-heading font-extrabold text-amber-100">{featureName} bloqueado no plano gratuito</h2>
        <p className="mt-2 text-sm leading-relaxed text-amber-100/90">{description}</p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            to="/pricing"
            className="inline-flex h-10 items-center rounded-xl bg-brand-400 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
          >
            Ver planos
          </Link>
          <p className="text-xs text-amber-200/85">Com assinatura ativa, este recurso é liberado automaticamente.</p>
        </div>
      </div>
    </div>
  );
}
