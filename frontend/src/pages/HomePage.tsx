import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { quoteStorage } from '../services/quoteStorage';
import { packagesStorage, type StoredPackagesQuote } from '../services/packagesStorage';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { formatBRL } from '../components/ui/PriceTag';

export function HomePage() {
  const navigate = useNavigate();
  const quotes = quoteStorage.getAll();
  const packageQuotes = packagesStorage.getAll();
  const [redownloading, setRedownloading] = useState<string | null>(null);

  const handleDeleteClassic = (id: string) => {
    quoteStorage.delete(id);
    window.location.reload();
  };

  const handleDeletePackage = (id: string) => {
    packagesStorage.delete(id);
    window.location.reload();
  };

  const handleRedownload = async (quote: StoredPackagesQuote) => {
    setRedownloading(quote.id);
    try {
      const res = await fetch('/api/packages/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quote),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      window.open(data.pdfUrl, '_blank');
    } catch {
      alert('Erro ao gerar o PDF. Verifique se o backend está rodando.');
    } finally {
      setRedownloading(null);
    }
  };

  const handleEdit = (quote: StoredPackagesQuote) => {
    const formData = {
      clientName: quote.clientName,
      projectName: quote.projectName,
      projectDescription: quote.projectDescription,
      referenceUrl: quote.referenceUrl ?? '',
      plans: quote.plans.map((p) => ({
        name: p.name,
        priceAVista: p.priceAVista.toString(),
        priceInstallments: p.priceInstallments?.toString() ?? '',
        monthlyFee: p.monthlyFee?.toString() ?? '',
        monthlyFeeDescription: p.monthlyFeeDescription ?? '',
        features: p.features,
        highlighted: p.highlighted,
      })),
      deliveryDays: quote.deliveryDays,
      paymentTerms: quote.paymentTerms,
      paymentMethods: quote.paymentMethods,
      installments: quote.installments,
      validityDays: quote.validityDays.toString(),
    };
    localStorage.setItem('prottoset_draft_packages', JSON.stringify(formData));
    navigate('/pacotes');
  };

  const minPriceAVista = (quote: StoredPackagesQuote) => {
    const plans = Array.isArray(quote.plans) ? quote.plans : [];
    return plans.length > 0 ? Math.min(...plans.map((p) => p.priceAVista)) : 0;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand-950">Orçamentos</h2>
          <p className="text-sm text-brand-400 mt-0.5">Gerencie seus orçamentos gerados</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/novo')}>Novo Orçamento</Button>
          <Button variant="outline" onClick={() => navigate('/pacotes')}>
            Proposta por Pacotes
          </Button>
        </div>
      </div>

      {/* Classic quotes */}
      <section>
        <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-3">
          Orçamentos por serviço
        </h3>
        {quotes.length === 0 ? (
          <Card className="text-center py-10" gradient>
            <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-brand-400 text-sm mb-3">Nenhum orçamento gerado ainda</p>
            <Button onClick={() => navigate('/novo')}>Criar Orçamento</Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {quotes.map((quote) => (
              <Card key={quote.id} hover className="flex items-center justify-between !p-4">
                <div>
                  <h4 className="text-sm font-semibold text-brand-950">{quote.project.name}</h4>
                  <p className="text-xs text-brand-400">
                    {quote.client.name}
                    {quote.client.company && ` · ${quote.client.company}`}
                  </p>
                  <p className="text-xs text-brand-300 mt-0.5">
                    {new Date(quote.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold gradient-text">{formatBRL(quote.total)}</span>
                  <a
                    href={`/api/quotes/${quote.id}/pdf`}
                    className="text-xs font-medium text-brand-500 hover:text-brand-700 transition-colors"
                    download
                  >
                    PDF
                  </a>
                  <button
                    onClick={() => handleDeleteClassic(quote.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Excluir
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Package proposals */}
      <section>
        <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-3">
          Propostas por pacotes
        </h3>
        {packageQuotes.length === 0 ? (
          <Card className="text-center py-10" gradient>
            <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-brand-400 text-sm mb-3">Nenhuma proposta gerada ainda</p>
            <Button variant="outline" onClick={() => navigate('/pacotes')}>Criar Proposta</Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {packageQuotes.map((quote) => (
              <Card key={quote.id} hover className="flex items-center justify-between !p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-brand-950">{quote.projectName}</h4>
                    <span className="text-[10px] px-2 py-0.5 bg-brand-50 text-brand-600 rounded-full font-semibold">
                      {quote.plans.length} planos
                    </span>
                  </div>
                  <p className="text-xs text-brand-400">{quote.clientName}</p>
                  <p className="text-xs text-brand-300 mt-0.5">
                    {new Date(quote.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] text-brand-300">a partir de</p>
                    <span className="text-sm font-bold gradient-text">
                      {formatBRL(minPriceAVista(quote))}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRedownload(quote)}
                    disabled={redownloading === quote.id}
                    className="text-xs font-medium text-brand-500 hover:text-brand-700 disabled:opacity-50 transition-colors"
                  >
                    {redownloading === quote.id ? 'Gerando...' : 'PDF'}
                  </button>
                  <button
                    onClick={() => handleEdit(quote)}
                    className="text-xs text-brand-400 hover:text-brand-600 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeletePackage(quote.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Excluir
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
