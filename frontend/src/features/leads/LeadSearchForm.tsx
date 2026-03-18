import { useState, useEffect } from 'react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { queuesAPI } from '../queues/queues.api';
import type { PhoneQueue } from '../queues/queues.types';
import type { LeadSearchParams } from './leads.types';

interface LeadSearchFormProps {
  onSearch: (params: LeadSearchParams, queueId?: string) => void;
  loading: boolean;
}

export function LeadSearchForm({ onSearch, loading }: LeadSearchFormProps) {
  const [form, setForm] = useState<LeadSearchParams>({
    searchTerm: '',
    city: '',
  });

  const [queues, setQueues] = useState<PhoneQueue[]>([]);
  const [selectedQueue, setSelectedQueue] = useState('none');
  const [showNewQueue, setShowNewQueue] = useState(false);
  const [newQueueName, setNewQueueName] = useState('');
  const [creatingQueue, setCreatingQueue] = useState(false);

  useEffect(() => {
    queuesAPI.getAll().then(({ data }) => setQueues(data)).catch(() => {});
  }, []);

  const handleCreateQueue = async () => {
    if (!newQueueName.trim()) return;
    setCreatingQueue(true);
    try {
      const { data } = await queuesAPI.create(newQueueName.trim());
      setQueues((prev) => [...prev, data]);
      setSelectedQueue(data.id);
      setNewQueueName('');
      setShowNewQueue(false);
    } catch {
      console.error('Failed to create queue');
    } finally {
      setCreatingQueue(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.searchTerm.trim() || !form.city.trim()) return;
    onSearch(form, selectedQueue !== 'none' ? selectedQueue : undefined);
  };

  return (
    <Card gradient>
      <div className="mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-400 flex items-center justify-center shadow-sm shadow-brand-500/20">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-brand-950">Buscar no Google Maps</h3>
            <p className="text-xs text-brand-400 mt-0.5">
              Busca por nicho + cidade, gera bairros com IA e extrai emails dos sites
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nicho / Segmento"
            placeholder="ex: estúdio de tatuagem, barbearia, clínica odontológica"
            value={form.searchTerm}
            onChange={(e) => setForm((prev) => ({ ...prev, searchTerm: e.target.value }))}
            required
          />
          <Input
            label="Cidade"
            placeholder="ex: Belo Horizonte"
            value={form.city}
            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
            required
          />
        </div>

        {/* Queue selector */}
        <div className="bg-brand-50/50 border border-brand-100 rounded-xl px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-xs text-brand-500 font-medium">
              Adicionar telefones a uma fila automaticamente
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedQueue}
              onChange={(e) => {
                setSelectedQueue(e.target.value);
                setShowNewQueue(false);
              }}
              className="flex-1 px-3 py-2 bg-white border border-border rounded-xl text-sm text-brand-950
                focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400
                transition-all duration-200 appearance-none cursor-pointer"
            >
              <option value="none">Não adicionar</option>
              {queues.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name} ({q.phones.length} {q.phones.length === 1 ? 'num' : 'nums'})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewQueue(!showNewQueue)}
              className="px-3 py-2 bg-white hover:bg-brand-50 border border-border rounded-xl text-xs font-semibold
                text-brand-600 transition-colors shrink-0"
            >
              {showNewQueue ? 'Cancelar' : 'Nova fila'}
            </button>
          </div>
          {showNewQueue && (
            <div className="flex gap-2 animate-fade-in">
              <input
                value={newQueueName}
                onChange={(e) => setNewQueueName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateQueue(); } }}
                placeholder="Nome da fila..."
                className="flex-1 px-3 py-2 bg-white border border-border rounded-xl text-sm text-brand-950
                  placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400
                  transition-all duration-200"
              />
              <button
                type="button"
                onClick={handleCreateQueue}
                disabled={!newQueueName.trim() || creatingQueue}
                className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {creatingQueue ? '...' : 'Criar'}
              </button>
            </div>
          )}
        </div>

        <Button type="submit" disabled={loading || !form.searchTerm.trim() || !form.city.trim()}>
          {loading ? 'Gerando leads...' : 'Gerar Leads'}
        </Button>
      </form>
    </Card>
  );
}
