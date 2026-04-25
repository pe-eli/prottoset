import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../../features/auth/auth.api';
import type { AuthUser } from '../../features/auth/auth.api';
import { useSubscription } from '../../contexts/useSubscription';
import { leadsAPI, type LeadsDailyQuota } from '../../features/leads/leads.api';

interface HeaderProps {
  user: AuthUser;
  onLogout: () => void;
}

function formatSubscriptionBadge(planName: string, status: string): string {
  if (status === 'active') return planName;
  if (status === 'pending') return `${planName} (pendente)`;
  if (status === 'cancelled') return `${planName} (cancelado)`;
  if (status === 'paused') return `${planName} (pausado)`;
  return `${planName} (${status})`;
}

export function Header({ user, onLogout }: HeaderProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { subscription } = useSubscription();
  const [freeTierQuota, setFreeTierQuota] = useState<LeadsDailyQuota | null>(null);
  const hasActiveSubscription = subscription?.status === 'active';

  useEffect(() => {
    let mounted = true;

    if (hasActiveSubscription) {
      setFreeTierQuota(null);
      return () => {
        mounted = false;
      };
    }

    leadsAPI.getSearchQuota()
      .then(({ data }) => {
        if (!mounted) return;
        setFreeTierQuota(data.dailyLeadsQuota ?? null);
      })
      .catch(() => {
        if (!mounted) return;
        setFreeTierQuota(null);
      });

    return () => {
      mounted = false;
    };
  }, [hasActiveSubscription]);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } finally {
      onLogout();
    }
  };

  const initials = user.displayName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 glass border-b border-border">
      <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3 group">
            <span className="text-lg font-heading font-extrabold text-text-primary tracking-tight group-hover:text-brand-400 transition-colors">
              Clos<span className="text-brand-400">r</span>
            </span>
          </Link>
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-border-light bg-surface-secondary px-3 py-1.5">
            <span className="text-xs text-text-muted">Plano:</span>
            <span className="text-xs font-semibold text-brand-300">
              {subscription ? formatSubscriptionBadge(subscription.planName, subscription.status) : 'Sem assinatura'}
            </span>
          </div>
          {hasActiveSubscription && subscription && (
            <>
              <div className="hidden md:flex items-center gap-1.5 rounded-xl border border-border-light bg-surface-secondary px-2.5 py-1 text-[11px] text-text-secondary">
                <span className="text-text-muted">Leads:</span>
                <strong className="text-text-primary">
                  {subscription.usage.leadsUsed.toLocaleString('pt-BR')}
                  {subscription.limits.leads_per_month === null ? '' : ` / ${subscription.limits.leads_per_month.toLocaleString('pt-BR')}`}
                </strong>
              </div>
              <div className="hidden md:flex items-center gap-1.5 rounded-xl border border-border-light bg-surface-secondary px-2.5 py-1 text-[11px] text-text-secondary">
                <span className="text-text-muted">Créditos IA:</span>
                <strong className="text-text-primary">
                  {subscription.usage.aiCreditsUsed.toLocaleString('pt-BR')}
                  {subscription.limits.ai_credits === null ? '' : ` / ${subscription.limits.ai_credits.toLocaleString('pt-BR')}`}
                </strong>
              </div>
            </>
          )}
          {!hasActiveSubscription && freeTierQuota?.applied && (
            <div className="hidden md:flex items-center gap-1.5 rounded-xl border border-amber-300/25 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-100">
              <span className="text-amber-200/80">Leads hoje:</span>
              <strong>
                {freeTierQuota.used}
                {freeTierQuota.limit === null ? '' : ` / ${freeTierQuota.limit}`}
              </strong>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/[0.04] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <span className="hidden sm:block text-sm font-medium text-text-secondary max-w-[120px] truncate">
              {user.displayName}
            </span>
            <svg
              className={`w-4 h-4 text-text-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-surface-elevated rounded-xl border border-border-light shadow-2xl shadow-black/30 z-50 py-1.5 animate-fade-in">
                <div className="px-4 py-2.5 border-b border-border">
                  <p className="text-sm font-medium text-text-primary truncate">{user.displayName}</p>
                  <p className="text-xs text-text-muted truncate">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); navigate('/configuracoes'); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-text-secondary hover:bg-white/[0.04] transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317a1 1 0 011.35-.936l1.575.631a1 1 0 00.75 0l1.575-.63a1 1 0 011.35.935l.234 1.87a1 1 0 00.485.724l1.62.944a1 1 0 01.366 1.366l-.933 1.615a1 1 0 000 .75l.933 1.615a1 1 0 01-.366 1.366l-1.62.944a1 1 0 00-.485.724l-.234 1.87a1 1 0 01-1.35.936l-1.575-.631a1 1 0 00-.75 0l-1.575.63a1 1 0 01-1.35-.935l-.234-1.87a1 1 0 00-.485-.724l-1.62-.944a1 1 0 01-.366-1.366l.933-1.615a1 1 0 000-.75l-.933-1.615a1 1 0 01.366-1.366l1.62-.944a1 1 0 00.485-.724l.234-1.87z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Configurações</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); navigate('/assinatura'); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-text-secondary hover:bg-white/[0.04] transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span>Assinatura</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/10 transition-colors flex items-center gap-2.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
