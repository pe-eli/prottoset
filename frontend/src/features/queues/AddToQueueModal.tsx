import { useState, useEffect } from 'react';
import { queuesAPI } from './queues.api';
import type { PhoneQueue } from './queues.types';

interface AddToQueueModalProps {
  phones: string[];
  onClose: () => void;
}

export function AddToQueueModal({ phones, onClose }: AddToQueueModalProps) {
  const [queues, setQueues] = useState<PhoneQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchQueues = async () => {
    try {
      const { data } = await queuesAPI.getAll();
      setQueues(Array.isArray(data) ? data : []);
    } catch {
      console.error('Failed to fetch queues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueues();
  }, []);

  const handleAdd = async (queue: PhoneQueue) => {
    setAddingTo(queue.id);
    try {
      const { data } = await queuesAPI.addPhones(queue.id, phones);
      setQueues((prev) => prev.map((q) => (q.id === data.id ? data : q)));
      setSuccess(queue.name);
      setTimeout(() => setSuccess(null), 2000);
    } catch {
      console.error('Failed to add phone');
    } finally {
      setAddingTo(null);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data: created } = await queuesAPI.create(newName.trim());
      const { data: updated } = await queuesAPI.addPhones(created.id, phones);
      setQueues((prev) => [...prev, updated]);
      setNewName('');
      setSuccess(created.name);
      setTimeout(() => setSuccess(null), 2000);
    } catch {
      console.error('Failed to create queue');
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
  };

  const allInQueue = (queue: PhoneQueue) => phones.every((p) => queue.phones.includes(p));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-950/20 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-sm border border-border-light animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-0">
          <div>
            <h3 className="text-sm font-bold text-brand-950">Adicionar a Fila</h3>
            <p className="text-xs text-brand-400 mt-0.5">
              {phones.length} {phones.length === 1 ? 'número' : 'números'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-brand-50 hover:bg-brand-100 flex items-center justify-center transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Success feedback */}
          {success && (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl animate-fade-in">
              <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs text-emerald-700 font-medium">Adicionado a "{success}"</span>
            </div>
          )}

          {/* Create new queue */}
          <div>
            <h4 className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-2">Nova fila</h4>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nome da fila..."
                className="flex-1 px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950
                  placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400
                  transition-all duration-200"
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {creating ? '...' : 'Criar'}
              </button>
            </div>
          </div>

          {/* Existing queues */}
          {queues.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-2">Filas existentes</h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {queues.map((q) => {
                  const already = allInQueue(q);
                  const isAdding = addingTo === q.id;
                  return (
                    <div
                      key={q.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-secondary border border-border-light hover:bg-brand-50/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-brand-950 truncate">{q.name}</p>
                        <p className="text-[10px] text-brand-300">
                          {q.phones.length} {q.phones.length === 1 ? 'número' : 'números'}
                        </p>
                      </div>
                      {already ? (
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAdd(q)}
                          disabled={isAdding}
                          className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center
                            transition-colors shrink-0 disabled:opacity-50"
                        >
                          {isAdding ? (
                            <svg className="w-3 h-3 text-emerald-500 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <p className="text-xs text-brand-300 text-center py-2">Carregando filas...</p>
          )}

          {/* Empty state */}
          {!loading && queues.length === 0 && (
            <p className="text-xs text-brand-300 text-center py-2">Nenhuma fila criada. Crie uma acima.</p>
          )}
        </div>
      </div>
    </div>
  );
}
