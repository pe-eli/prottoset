import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand-950">Orçamentos</h2>
          <p className="text-sm text-brand-400 mt-0.5">Crie propostas por pacotes em um fluxo único</p>
        </div>
        <Button onClick={() => navigate('/pacotes')}>Novo Orçamento</Button>
      </div>

      {/* Package proposals */}
      <section>
        <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-3">
          Novo orçamento por pacotes
        </h3>
        <Card className="text-center py-10" gradient>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <Button variant="outline" onClick={() => navigate('/pacotes')}>Novo Orçamento</Button>
        </Card>
      </section>
    </div>
  );
}
