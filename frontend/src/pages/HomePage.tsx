import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { quoteAPI } from '../services/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { formatBRL } from '../components/ui/PriceTag';
import type { Quote } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);

  useEffect(() => {
    let mounted = true;
    quoteAPI
      .list()
      .then(({ data }) => {
        if (!mounted) return;
        setQuotes(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!mounted) return;
        setQuotes([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingQuotes(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

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
        {loadingQuotes ? (
          <Card className="text-center py-10" gradient>
            <p className="text-brand-400 text-sm">Carregando orçamentos...</p>
          </Card>
        ) : quotes.length === 0 ? (
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
        <Card className="text-center py-10" gradient>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-brand-400 text-sm mb-3">As propostas não ficam salvas no navegador.</p>
          <Button variant="outline" onClick={() => navigate('/pacotes')}>Criar Proposta</Button>
        </Card>
      </section>
    </div>
  );
}
