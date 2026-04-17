import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { AuthUser } from '../features/auth/auth.api';
import { authAPI } from '../features/auth/auth.api';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Card } from '../components/ui/Card';

function formatLimit(limit: number | null, suffix: string): string {
  if (limit === null) return 'Ilimitado';
  return `${limit.toLocaleString('pt-BR')} ${suffix}`;
}

function formatStatus(status: string | undefined): string {
  if (!status) return 'Sem assinatura';
  if (status === 'active') return 'Ativa';
  if (status === 'pending') return 'Pendente';
  if (status === 'cancelled') return 'Cancelada';
  if (status === 'paused') return 'Pausada';
  return status;
}

function estimateRemainingMessages(creditsRemaining: number): number {
  const avgCreditsPerMessage = 25; // ~250 tokens / 10
  return Math.floor(creditsRemaining / avgCreditsPerMessage);
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useOutletContext<{ user: AuthUser }>();
  const { subscription, loading } = useSubscription();
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const navigateToVerifyEmail = (verificationId?: string, cooldownSeconds = 60) => {
    const query = new URLSearchParams({
      email: user.email,
      cooldown: String(Math.max(0, cooldownSeconds)),
    });
    if (verificationId) query.set('verificationId', verificationId);
    navigate(`/verify-email?${query.toString()}`);
  };

  const getRetryAfterSeconds = (err: any): number => {
    const rawHeader = err?.response?.headers?.['retry-after'];
    const retryAfter = Number(rawHeader);
    return Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60;
  };

  const handleVerifyEmailAgain = async () => {
    setVerificationError(null);
    setVerificationNotice(null);
    setVerificationLoading(true);

    try {
      const { data } = await authAPI.resendCode(user.email);
      setVerificationNotice('Código enviado. Redirecionando para a confirmação...');
      navigateToVerifyEmail(data.verificationId, 60);
      return;
    } catch (err: any) {
      if (err?.response?.status === 429) {
        setVerificationNotice('Você já solicitou recentemente. Vamos abrir a tela de confirmação com o contador.');
        navigateToVerifyEmail(undefined, getRetryAfterSeconds(err));
        return;
      }

      setVerificationError(err?.response?.data?.error || 'Não foi possível iniciar a verificação agora.');
    } finally {
      setVerificationLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-text-primary">Configurações</h1>
        <p className="text-sm text-text-muted mt-1">Gerencie seus dados de cadastro e a situação da sua assinatura.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <h2 className="text-sm font-semibold text-brand-400 uppercase tracking-widest mb-4">Cadastro</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-text-muted">Nome completo</p>
              <p className="text-sm font-medium text-text-primary">{user.displayName}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">E-mail registrado</p>
              <p className="text-sm font-medium text-text-primary">{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Situação do e-mail</p>
              <p className="text-sm font-medium text-text-primary">{user.emailVerified ? 'Verificado' : 'Pendente de verificação'}</p>
            </div>
            {!user.emailVerified && (
              <div className="pt-1 space-y-2">
                <button
                  type="button"
                  onClick={handleVerifyEmailAgain}
                  disabled={verificationLoading}
                  className="inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 px-4 py-2 text-sm border border-brand-400/40 text-brand-300 hover:bg-brand-400/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verificationLoading ? 'Preparando verificação...' : 'Verificar e-mail novamente'}
                </button>
                {verificationNotice && (
                  <p className="text-xs text-mint">{verificationNotice}</p>
                )}
                {verificationError && (
                  <p className="text-xs text-red-400">{verificationError}</p>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-brand-400 uppercase tracking-widest mb-4">Assinatura</h2>
          {loading ? (
            <p className="text-sm text-text-muted">Carregando assinatura...</p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-text-muted">Plano</p>
                <p className="text-sm font-medium text-text-primary">{subscription?.planName ?? 'Sem plano ativo'}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Status</p>
                <p className="text-sm font-medium text-text-primary">{formatStatus(subscription?.status)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Vigência atual</p>
                <p className="text-sm font-medium text-text-primary">
                  {subscription?.currentPeriodEnd
                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')
                    : '-'}
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-brand-400 uppercase tracking-widest mb-4">Limites do plano</h2>
        {!subscription ? (
          <p className="text-sm text-text-muted">Sem assinatura ativa para exibir limites.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border-light bg-surface-secondary px-4 py-3">
              <p className="text-xs text-text-muted">Leads por mês</p>
              <p className="text-sm font-semibold text-text-primary">{formatLimit(subscription.limits.leads_per_month, 'leads')}</p>
            </div>
            <div className="rounded-xl border border-border-light bg-surface-secondary px-4 py-3">
              <p className="text-xs text-text-muted">WhatsApp</p>
              <p className="text-sm font-semibold text-text-primary">Controlado pelos créditos de IA</p>
            </div>
            <div className="rounded-xl border border-border-light bg-surface-secondary px-4 py-3">
              <p className="text-xs text-text-muted">E-mails por mês</p>
              <p className="text-sm font-semibold text-text-primary">{formatLimit(subscription.limits.emails_per_month, 'e-mails')}</p>
            </div>
            <div className="rounded-xl border border-border-light bg-surface-secondary px-4 py-3">
              <p className="text-xs text-text-muted">Créditos de IA</p>
              <p className="text-sm font-semibold text-text-primary">{formatLimit(subscription.limits.ai_credits, 'créditos')}</p>
            </div>
          </div>
        )}
      </Card>

      {subscription && (
        <Card>
          <h2 className="text-sm font-semibold text-brand-400 uppercase tracking-widest mb-4">Créditos de IA</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border-light bg-surface-secondary px-4 py-3">
              <p className="text-xs text-text-muted">Créditos usados</p>
              <p className="text-lg font-bold text-text-primary">{subscription.usage.aiCreditsUsed.toLocaleString('pt-BR')}</p>
            </div>
            <div className="rounded-xl border border-border-light bg-surface-secondary px-4 py-3">
              <p className="text-xs text-text-muted">Créditos restantes</p>
              <p className="text-lg font-bold text-text-primary">
                {subscription.limits.ai_credits === null
                  ? 'Ilimitado'
                  : Math.max(0, subscription.limits.ai_credits - subscription.usage.aiCreditsUsed).toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="rounded-xl border border-border-light bg-surface-secondary px-4 py-3">
              <p className="text-xs text-text-muted">Estimativa de mensagens IA</p>
              <p className="text-lg font-bold text-text-primary">
                {subscription.limits.ai_credits === null
                  ? 'Ilimitado'
                  : `~${estimateRemainingMessages(Math.max(0, subscription.limits.ai_credits - subscription.usage.aiCreditsUsed)).toLocaleString('pt-BR')} mensagens`}
              </p>
            </div>
          </div>
          {subscription.limits.ai_credits !== null && (
            <div className="mt-3">
              <div className="w-full bg-surface-secondary rounded-full h-2.5">
                <div
                  className="bg-brand-400 h-2.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (subscription.usage.aiCreditsUsed / subscription.limits.ai_credits) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-text-muted mt-1.5 text-right">
                {subscription.usage.aiCreditsUsed.toLocaleString('pt-BR')} / {subscription.limits.ai_credits.toLocaleString('pt-BR')} créditos
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
