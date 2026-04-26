import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { subscriptionsAPI, type Invoice, type SubscriptionInfo } from '../features/subscriptions/subscriptions.api';

interface ApiErrorPayload {
  error?: string;
}

function formatCurrency(centavos: number, currency: string): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: currency.toUpperCase() });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    paid: 'bg-mint/20 text-mint border-mint/30',
    open: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
    void: 'bg-zinc-700 text-zinc-400 border-zinc-600',
    uncollectible: 'bg-red-400/20 text-red-400 border-red-400/30',
  };
  const labelMap: Record<string, string> = { paid: 'Pago', open: 'Aberto', void: 'Cancelada', uncollectible: 'Inadimplente' };
  const cls = map[status] ?? 'bg-zinc-700 text-zinc-400 border-zinc-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {labelMap[status] ?? status}
    </span>
  );
};

export function BillingPage() {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([subscriptionsAPI.getMe(), subscriptionsAPI.getBillingHistory()])
      .then(([meRes, histRes]) => {
        setSubscription(meRes.data.subscription);
        setInvoices(histRes.data.invoices);
      })
      .catch((err: unknown) => {
        const apiError = isAxiosError<ApiErrorPayload>(err) ? err.response?.data?.error : undefined;
        setError(apiError || 'Erro ao carregar dados');
      })
      .finally(() => setLoading(false));
  }, []);

  const handlePortal = async () => {
    try {
      setPortalLoading(true);
      setError(null);
      const { data } = await subscriptionsAPI.getBillingPortalUrl();
      window.location.assign(data.url);
    } catch (err: unknown) {
      const apiError = isAxiosError<ApiErrorPayload>(err) ? err.response?.data?.error : undefined;
      setError(apiError || 'Erro ao abrir portal');
      setPortalLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Tem certeza que deseja cancelar? Seu acesso continuará até o fim do ciclo atual.')) return;
    try {
      setCancelLoading(true);
      setError(null);
      await subscriptionsAPI.cancel();
      setSuccessMsg('Assinatura cancelada. Você terá acesso até o fim do ciclo atual.');
      const { data } = await subscriptionsAPI.getMe();
      setSubscription(data.subscription);
    } catch (err: unknown) {
      const apiError = isAxiosError<ApiErrorPayload>(err) ? err.response?.data?.error : undefined;
      setError(apiError || 'Erro ao cancelar');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleReactivate = async () => {
    try {
      setReactivateLoading(true);
      setError(null);
      await subscriptionsAPI.reactivate();
      setSuccessMsg('Assinatura reativada com sucesso!');
      const { data } = await subscriptionsAPI.getMe();
      setSubscription(data.subscription);
    } catch (err: unknown) {
      const apiError = isAxiosError<ApiErrorPayload>(err) ? err.response?.data?.error : undefined;
      setError(apiError || 'Erro ao reativar');
    } finally {
      setReactivateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-9 w-9 rounded-full border-2 border-border border-t-brand-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => void navigate(-1)} className="text-text-muted hover:text-text-primary text-sm">
            ← Voltar
          </button>
          <h1 className="text-2xl font-heading font-bold text-text-primary">Cobrança e assinatura</h1>
        </div>

        {error && (
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="rounded-xl border border-mint/20 bg-mint/10 px-4 py-3 text-sm text-mint">
            {successMsg}
          </div>
        )}

        {/* Current plan */}
        <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
          <h2 className="text-base font-semibold text-text-primary">Plano atual</h2>
          {subscription ? (
            <>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-lg font-bold text-brand-400">{subscription.planName}</p>
                  <p className="text-sm text-text-muted">
                    Status: <span className="text-text-secondary capitalize">{subscription.status}</span>
                    {subscription.currentPeriodEnd && (
                      <> · Próxima cobrança: <strong>{formatDate(subscription.currentPeriodEnd)}</strong></>
                    )}
                  </p>
                  {subscription.cancelAtPeriodEnd && (
                    <p className="text-sm text-yellow-300 mt-1">Cancelamento ao fim do ciclo atual.</p>
                  )}
                  {subscription.scheduledPlan && !subscription.cancelAtPeriodEnd && (
                    <p className="text-sm text-yellow-300 mt-1">
                      Downgrade para <strong>{subscription.scheduledPlan}</strong> agendado ao fim do ciclo.
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => void navigate('/pricing')}
                    className="h-9 px-4 rounded-xl border border-border-light text-sm text-text-primary hover:border-brand-400/30"
                  >
                    Trocar plano
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePortal()}
                    disabled={portalLoading}
                    className="h-9 px-4 rounded-xl bg-brand-400 text-white text-sm font-semibold hover:bg-brand-500 disabled:opacity-50"
                  >
                    {portalLoading ? 'Aguarde...' : 'Gerenciar pagamento'}
                  </button>
                </div>
              </div>

              <div className="border-t border-border pt-4 flex gap-3 flex-wrap">
                {subscription.cancelAtPeriodEnd ? (
                  <button
                    type="button"
                    onClick={() => void handleReactivate()}
                    disabled={reactivateLoading}
                    className="text-sm text-mint underline underline-offset-2 disabled:opacity-50"
                  >
                    {reactivateLoading ? 'Aguarde...' : 'Reativar assinatura'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleCancel()}
                    disabled={cancelLoading}
                    className="text-sm text-red-400 underline underline-offset-2 disabled:opacity-50"
                  >
                    {cancelLoading ? 'Aguarde...' : 'Cancelar assinatura'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div>
              <p className="text-sm text-text-muted mb-4">Você não possui uma assinatura ativa.</p>
              <button
                type="button"
                onClick={() => void navigate('/pricing')}
                className="h-9 px-4 rounded-xl bg-brand-400 text-white text-sm font-semibold hover:bg-brand-500"
              >
                Ver planos
              </button>
            </div>
          )}
        </div>

        {/* Billing history */}
        {invoices.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4">Histórico de cobranças</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-muted text-xs border-b border-border">
                    <th className="pb-2 pr-4">Data</th>
                    <th className="pb-2 pr-4">Valor</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-3 pr-4 text-text-secondary">{formatDate(inv.paidAt ?? inv.createdAt)}</td>
                      <td className="py-3 pr-4 text-text-primary font-medium">{formatCurrency(inv.amount, inv.currency)}</td>
                      <td className="py-3 pr-4"><StatusBadge status={inv.status} /></td>
                      <td className="py-3">
                        {inv.invoicePdf ? (
                          <a href={inv.invoicePdf} target="_blank" rel="noreferrer" className="text-brand-400 underline underline-offset-2 text-xs">
                            Baixar
                          </a>
                        ) : inv.hostedInvoiceUrl ? (
                          <a href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="text-brand-400 underline underline-offset-2 text-xs">
                            Ver
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
