import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

interface PlanConfig {
  name: string;
  priceAVista: string;
  priceInstallments: string;
  monthlyFee: string;
  monthlyFeeDescription: string;
  features: string[];
  highlighted: boolean;
}

interface FormData {
  clientName: string;
  projectName: string;
  projectDescription: string;
  referenceUrl: string;
  plans: PlanConfig[];
  deliveryDays: string;
  paymentTerms: string;
  paymentMethods: Array<'pix' | 'cartao' | 'boleto'>;
  installments: number;
  validityDays: string;
}

const DEFAULT_PLANS: PlanConfig[] = [
  { name: 'Básico', priceAVista: '', priceInstallments: '', monthlyFee: '', monthlyFeeDescription: '', features: [], highlighted: false },
  { name: 'Profissional', priceAVista: '', priceInstallments: '', monthlyFee: '', monthlyFeeDescription: '', features: [], highlighted: true },
  { name: 'Premium', priceAVista: '', priceInstallments: '', monthlyFee: '', monthlyFeeDescription: '', features: [], highlighted: false },
];

const INITIAL_FORM: FormData = {
  clientName: '',
  projectName: '',
  projectDescription: '',
  referenceUrl: '',
  plans: DEFAULT_PLANS.map((p) => ({ ...p })),
  deliveryDays: '7 a 10 dias',
  paymentTerms: '50% no início e 50% na entrega',
  paymentMethods: ['pix'],
  installments: 1,
  validityDays: '7',
};

export function PackagesQuotePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [newFeature, setNewFeature] = useState(['', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updatePlan = (index: number, changes: Partial<PlanConfig>) => {
    setForm((prev) => ({
      ...prev,
      plans: prev.plans.map((p, i) => (i === index ? { ...p, ...changes } : p)),
    }));
  };

  const setHighlighted = (index: number) => {
    setForm((prev) => ({
      ...prev,
      plans: prev.plans.map((p, i) => ({ ...p, highlighted: i === index })),
    }));
  };

  const addFeature = (planIndex: number) => {
    const feat = newFeature[planIndex].trim();
    if (!feat) return;
    updatePlan(planIndex, {
      features: [...form.plans[planIndex].features, feat],
    });
    setNewFeature((prev) => prev.map((f, i) => (i === planIndex ? '' : f)));
  };

  const removeFeature = (planIndex: number, featIndex: number) => {
    updatePlan(planIndex, {
      features: form.plans[planIndex].features.filter((_, i) => i !== featIndex),
    });
  };

  const formatPaymentMethod = (): string => {
    const labels: Record<string, string> = {
      pix: 'PIX',
      boleto: 'Boleto Bancário',
      cartao: form.installments <= 1 ? 'Cartão à vista' : `Cartão em ${form.installments}x`,
    };
    const order: Array<'pix' | 'cartao' | 'boleto'> = ['pix', 'cartao', 'boleto'];
    return order
      .filter((m) => form.paymentMethods.includes(m))
      .map((m) => labels[m])
      .join(' · ');
  };

  const handleSubmit = async () => {
    if (!form.clientName || !form.projectName || !form.projectDescription) {
      setError('Preencha cliente, nome e descrição do projeto.');
      return;
    }
    for (const plan of form.plans) {
      if (!plan.name || !plan.priceAVista || plan.features.length === 0) {
        setError(`O plano "${plan.name}" precisa de nome, preço e ao menos um recurso.`);
        return;
      }
    }
    setError('');
    setLoading(true);
    try {
      const id = uuidv4();
      const createdAt = new Date().toISOString();
      const payload = {
        id,
        clientName: form.clientName,
        projectName: form.projectName,
        projectDescription: form.projectDescription,
        ...(form.referenceUrl && { referenceUrl: form.referenceUrl }),
        plans: form.plans.map((p) => ({
          name: p.name,
          priceAVista: parseFloat(p.priceAVista.replace(',', '.')),
          ...(p.priceInstallments && {
            priceInstallments: parseFloat(p.priceInstallments.replace(',', '.')),
          }),
          ...(p.monthlyFee && {
            monthlyFee: parseFloat(p.monthlyFee.replace(',', '.')),
            monthlyFeeDescription: p.monthlyFeeDescription,
          }),
          features: p.features,
          highlighted: p.highlighted,
        })),
        deliveryDays: form.deliveryDays,
        paymentTerms: form.paymentTerms,
        paymentMethod: formatPaymentMethod(),
        paymentMethods: form.paymentMethods,
        installments: form.installments,
        validityDays: parseInt(form.validityDays, 10) || 7,
        createdAt,
      };

      const res = await fetch('/api/packages/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Erro do servidor');
      const data = await res.json();
      window.open(data.pdfUrl, '_blank');
    } catch {
      setError('Erro ao gerar a proposta. Verifique se o backend está rodando.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Proposta por Pacotes</h2>
          <p className="text-sm text-text-secondary">Básico, Profissional e Premium</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/')}>
            Voltar
          </Button>
        </div>
      </div>

      {/* PROJETO */}
      <Card>
        <h3 className="text-sm font-semibold text-text-primary mb-4">Informações do Projeto</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Input
            label="Nome do Cliente"
            placeholder="Ex: João Silva"
            value={form.clientName}
            onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}
          />
          <Input
            label="Nome do Projeto"
            placeholder="Ex: Site de Agendamentos"
            value={form.projectName}
            onChange={(e) => setForm((p) => ({ ...p, projectName: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">Descrição do Projeto</label>
          <textarea
            rows={3}
            className="px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            placeholder="Descreva brevemente o projeto e o objetivo do cliente..."
            value={form.projectDescription}
            onChange={(e) => setForm((p) => ({ ...p, projectDescription: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5 mt-4">
          <label className="text-sm font-medium text-text-primary">Link de referência <span className="text-xs font-normal text-text-muted">(opcional)</span></label>
          <input
            type="url"
            className="px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="https://exemplo.com"
            value={form.referenceUrl}
            onChange={(e) => setForm((p) => ({ ...p, referenceUrl: e.target.value }))}
          />
          <p className="text-xs text-text-muted">Tenha uma ideia de como pode ficar seu projeto</p>
        </div>
      </Card>

      {/* PLANOS */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Configuração dos Planos</h3>
        <div className="grid grid-cols-3 gap-4">
          {form.plans.map((plan, pi) => (
            <Card
              key={pi}
              className={`p-4 transition-all ${plan.highlighted ? 'ring-2 ring-brand-500' : ''}`}
            >
              <div className="space-y-3">
                <Input
                  label="Nome do Plano"
                  value={plan.name}
                  onChange={(e) => updatePlan(pi, { name: e.target.value })}
                />

                {/* PREÇOS */}
                <div className="border border-border-light rounded-lg p-2.5 flex flex-col gap-2 bg-surface-secondary/80">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-green-700 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                      Preço PIX / À vista (R$)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      className="px-3 py-2 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 bg-surface"
                      placeholder="Ex: 1500"
                      value={plan.priceAVista}
                      onChange={(e) => updatePlan(pi, { priceAVista: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-text-secondary flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                      Parcelado (R$) <span className="font-normal text-text-muted">opcional</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      className="px-3 py-2 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 bg-surface"
                      placeholder="Ex: 1800"
                      value={plan.priceInstallments}
                      onChange={(e) => updatePlan(pi, { priceInstallments: e.target.value })}
                    />
                  </div>
                  {plan.priceAVista && plan.priceInstallments &&
                    parseFloat(plan.priceInstallments) > parseFloat(plan.priceAVista) && (
                    <p className="text-xs text-green-600 font-medium">
                      ✦ Economia de R$ {(parseFloat(plan.priceInstallments) - parseFloat(plan.priceAVista)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} pagando à vista
                    </p>
                  )}
                </div>

                {/* MENSALIDADE */}
                <div className="border-t border-border-light pt-3 flex flex-col gap-2">
                  <p className="text-xs font-semibold text-text-secondary">Mensalidade (opcional)</p>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-text-secondary">Valor mensal (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="Ex: 150"
                      value={plan.monthlyFee}
                      onChange={(e) => updatePlan(pi, { monthlyFee: e.target.value })}
                    />
                  </div>
                  {plan.monthlyFee && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-text-secondary">O que contempla</label>
                      <textarea
                        rows={2}
                        className="px-2 py-1.5 bg-surface border border-border rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                        placeholder="Ex: Suporte técnico, hospedagem e backups automatizados"
                        value={plan.monthlyFeeDescription}
                        onChange={(e) => updatePlan(pi, { monthlyFeeDescription: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="highlighted"
                    checked={plan.highlighted}
                    onChange={() => setHighlighted(pi)}
                    className="accent-brand-600"
                  />
                  <span className="text-xs text-text-secondary">Destacar como Mais Popular</span>
                </label>

                {/* RECURSOS */}
                <div>
                  <p className="text-xs font-semibold text-text-secondary mb-1.5">
                    Recursos ({plan.features.length})
                  </p>

                  {plan.features.length > 0 && (
                    <ul className="space-y-1 mb-2">
                      {plan.features.map((feat, fi) => (
                        <li key={fi} className="flex items-start gap-1.5 text-xs text-text-secondary">
                          <span className="text-green-600 font-bold mt-0.5 flex-shrink-0">✓</span>
                          <span className="flex-1 leading-snug">{feat}</span>
                          <button
                            onClick={() => removeFeature(pi, fi)}
                            className="text-red-400 hover:text-red-600 flex-shrink-0 leading-none text-base"
                            title="Remover"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      className="flex-1 px-2 py-1.5 bg-surface border border-border rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-500"
                      placeholder="Ex: Suporte 24h"
                      value={newFeature[pi]}
                      onChange={(e) =>
                        setNewFeature((prev) => prev.map((f, i) => (i === pi ? e.target.value : f)))
                      }
                      onKeyDown={(e) => e.key === 'Enter' && addFeature(pi)}
                    />
                    <button
                      onClick={() => addFeature(pi)}
                      className="px-2.5 py-1.5 bg-brand-600 text-white rounded text-xs hover:bg-brand-700 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* CONDIÇÕES */}
      <Card>
        <h3 className="text-sm font-semibold text-text-primary mb-4">Condições da Proposta</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Prazo de Entrega"
            placeholder="Ex: 7 a 10 dias"
            value={form.deliveryDays}
            onChange={(e) => setForm((p) => ({ ...p, deliveryDays: e.target.value }))}
          />
          <Input
            label="Condição de Pagamento"
            placeholder="Ex: 50% início, 50% entrega"
            value={form.paymentTerms}
            onChange={(e) => setForm((p) => ({ ...p, paymentTerms: e.target.value }))}
          />

          {/* FORMA DE PAGAMENTO */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">Forma de Pagamento</label>
            <div className="flex gap-2">
              {(['pix', 'cartao', 'boleto'] as const).map((m) => {
                const active = form.paymentMethods.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      setForm((p) => {
                        const has = p.paymentMethods.includes(m);
                        if (has && p.paymentMethods.length === 1) return p;
                        return {
                          ...p,
                          paymentMethods: has
                            ? p.paymentMethods.filter((x) => x !== m)
                            : [...p.paymentMethods, m],
                        };
                      })
                    }
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      active
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-surface text-text-secondary border-border hover:border-brand-400'
                    }`}
                  >
                    {m === 'pix' ? 'PIX' : m === 'cartao' ? 'Cartão' : 'Boleto'}
                  </button>
                );
              })}
            </div>
            {form.paymentMethods.includes('cartao') && (
              <div className="flex flex-col gap-1 mt-1">
                <label className="text-xs font-medium text-text-secondary">Parcelamento</label>
                <select
                  className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.installments}
                  onChange={(e) => setForm((p) => ({ ...p, installments: Number(e.target.value) }))}
                >
                  <option value={1}>À vista</option>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                    <option key={n} value={n}>{n}x</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">Validade (dias)</label>
            <input
              type="number"
              min="1"
              className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={form.validityDays}
              onChange={(e) => setForm((p) => ({ ...p, validityDays: e.target.value }))}
            />
          </div>
        </div>
      </Card>

      {error && (
        <p className="text-sm text-red-200 bg-red-500/10 border border-red-400/20 px-4 py-2.5 rounded-lg">
          {error}
        </p>
      )}

      <div className="flex justify-end pb-8">
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Gerando...' : 'Gerar Proposta PDF'}
        </Button>
      </div>
    </div>
  );
}
