import { useOutletContext } from 'react-router-dom';
import type { AuthUser } from '../features/auth/auth.api';
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

export function SettingsPage() {
  const { user } = useOutletContext<{ user: AuthUser }>();
  const { subscription, loading } = useSubscription();

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
              <p className="text-xs text-text-muted">Mensagens WhatsApp</p>
              <p className="text-sm font-semibold text-text-primary">{formatLimit(subscription.limits.whatsapp_messages, 'mensagens')}</p>
            </div>
            <div className="rounded-xl border border-border-light bg-surface-secondary px-4 py-3">
              <p className="text-xs text-text-muted">E-mails por mês</p>
              <p className="text-sm font-semibold text-text-primary">{formatLimit(subscription.limits.emails_per_month, 'e-mails')}</p>
            </div>
            <div className="rounded-xl border border-border-light bg-surface-secondary px-4 py-3">
              <p className="text-xs text-text-muted">Orçamentos PDF</p>
              <p className="text-sm font-semibold text-text-primary">{formatLimit(subscription.limits.pdf_quotes, 'orçamentos')}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
