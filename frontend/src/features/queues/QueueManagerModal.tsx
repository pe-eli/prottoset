import { useState, useEffect } from 'react';
import { queuesAPI } from './queues.api';
import type { PhoneQueue } from './queues.types';

interface QueueManagerModalProps {
  onClose: () => void;
  onChanged?: () => void;
}

export function QueueManagerModal({ onClose, onChanged }: QueueManagerModalProps) {
  const [queues, setQueues] = useState<PhoneQueue[]>([]);
  const [loading, setLoading] = useState(true);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Merge state
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(new Set());
  const [mergeName, setMergeName] = useState('');
  const [merging, setMerging] = useState(false);

  // Expand state (view phones)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create state
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchQueues = async () => {
    try {
      const { data } = await queuesAPI.getAll();
      setQueues(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueues();
  }, []);

  const notify = () => onChanged?.();

  const handleDelete = async (id: string) => {
    try {
      await queuesAPI.delete(id);
      setQueues((prev) => prev.filter((q) => q.id !== id));
      notify();
    } catch {
      /* ignore */
    }
  };

  const handleRenameStart = (q: PhoneQueue) => {
    setRenamingId(q.id);
    setRenameValue(q.name);
  };

  const handleRenameConfirm = async () => {
    if (!renamingId || !renameValue.trim()) return;
    try {
      const response = await queuesAPI.rename(renamingId, renameValue.trim());
      setQueues((prev) => prev.map((q) => (q.id === response.data.id ? response.data : q)));
      notify();
    } catch {
      /* ignore */
    } finally {
      setRenamingId(null);
      setRenameValue('');
    }
  };

  const toggleMergeSelect = (id: string) => {
    setMergeSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMerge = async () => {
    if (mergeSelection.size < 2 || !mergeName.trim()) return;
    setMerging(true);
    try {
      const { data } = await queuesAPI.merge([...mergeSelection], mergeName.trim());
      // Refresh full list after merge
      const { data: refreshed } = await queuesAPI.getAll();
      setQueues(refreshed);
      setMergeMode(false);
      setMergeSelection(new Set());
      setMergeName('');
      notify();
    } catch {
      /* ignore */
    } finally {
      setMerging(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await queuesAPI.create(newName.trim());
      setQueues((prev) => [...prev, data]);
      setNewName('');
      notify();
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  };

  const handleRemovePhone = async (queueId: string, phone: string) => {
    try {
      const { data } = await queuesAPI.removePhone(queueId, phone);
      setQueues((prev) => prev.map((q) => (q.id === data.id ? data : q)));
      notify();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-950/20 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-border-light animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-border-light shrink-0">
          <div>
            <h3 className="text-base font-bold text-brand-950">Gerenciar Filas</h3>
            <p className="text-xs text-brand-400 mt-0.5">{queues.length} {queues.length === 1 ? 'fila' : 'filas'}</p>
          </div>
          <div className="flex items-center gap-2">
            {queues.length >= 2 && (
              <button
                onClick={() => { setMergeMode(!mergeMode); setMergeSelection(new Set()); setMergeName(''); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  mergeMode
                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                    : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                }`}
              >
                {mergeMode ? 'Cancelar junção' : 'Juntar filas'}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-brand-50 hover:bg-brand-100 flex items-center justify-center transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Create new */}
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
              placeholder="Nova fila..."
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

          {/* Merge bar */}
          {mergeMode && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2 animate-fade-in">
              <p className="text-xs text-amber-700 font-medium">
                Selecione 2 ou mais filas para juntar ({mergeSelection.size} selecionadas)
              </p>
              {mergeSelection.size >= 2 && (
                <div className="flex gap-2">
                  <input
                    value={mergeName}
                    onChange={(e) => setMergeName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleMerge(); } }}
                    placeholder="Nome da fila resultante..."
                    className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-xl text-sm text-brand-950
                      placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-amber-400/40
                      transition-all duration-200"
                  />
                  <button
                    onClick={handleMerge}
                    disabled={!mergeName.trim() || merging}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl
                      transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {merging ? '...' : 'Juntar'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Queue list */}
          {loading && (
            <p className="text-xs text-brand-300 text-center py-4">Carregando...</p>
          )}

          {!loading && queues.length === 0 && (
            <p className="text-xs text-brand-300 text-center py-4">Nenhuma fila criada</p>
          )}

          {queues.map((q) => (
            <div key={q.id} className="border border-border-light rounded-xl overflow-hidden">
              {/* Queue row */}
              <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                mergeMode && mergeSelection.has(q.id) ? 'bg-amber-50' : 'bg-surface-secondary'
              }`}>
                {/* Merge checkbox */}
                {mergeMode && (
                  <button
                    onClick={() => toggleMergeSelect(q.id)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${
                      mergeSelection.has(q.id)
                        ? 'bg-amber-500 border-amber-500'
                        : 'border-brand-300 hover:border-amber-400'
                    }`}
                  >
                    {mergeSelection.has(q.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )}

                {/* Name (or rename input) */}
                {renamingId === q.id ? (
                  <div className="flex-1 flex gap-2 min-w-0">
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleRenameConfirm(); }
                        if (e.key === 'Escape') { setRenamingId(null); }
                      }}
                      autoFocus
                      className="flex-1 px-2 py-1 bg-white border border-brand-300 rounded-lg text-sm text-brand-950
                        focus:outline-none focus:ring-2 focus:ring-brand-400/40 transition-all"
                    />
                    <button
                      onClick={handleRenameConfirm}
                      className="px-2 py-1 bg-brand-600 text-white text-xs font-semibold rounded-lg"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => setRenamingId(null)}
                      className="px-2 py-1 text-brand-400 text-xs font-medium"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                  >
                    <p className="text-sm font-medium text-brand-950 truncate">{q.name}</p>
                    <p className="text-[10px] text-brand-300">
                      {q.phones.length} {q.phones.length === 1 ? 'número' : 'números'}
                    </p>
                  </div>
                )}

                {/* Actions (hidden during merge mode or rename) */}
                {!mergeMode && renamingId !== q.id && (
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Expand/collapse */}
                    <button
                      onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                      className="w-7 h-7 rounded-lg bg-brand-50 hover:bg-brand-100 flex items-center justify-center transition-colors"
                      title="Ver números"
                    >
                      <svg className={`w-3 h-3 text-brand-400 transition-transform ${expandedId === q.id ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {/* Rename */}
                    <button
                      onClick={() => handleRenameStart(q)}
                      className="w-7 h-7 rounded-lg bg-brand-50 hover:bg-brand-100 flex items-center justify-center transition-colors"
                      title="Renomear"
                    >
                      <svg className="w-3 h-3 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                      title="Excluir"
                    >
                      <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded phones */}
              {expandedId === q.id && (
                <div className="border-t border-border-light bg-surface px-4 py-3 animate-fade-in">
                  {q.phones.length === 0 ? (
                    <p className="text-xs text-brand-300">Nenhum número nesta fila</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {q.phones.map((phone) => (
                        <span key={phone} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium border border-emerald-200">
                          {phone}
                          <button
                            onClick={() => handleRemovePhone(q.id, phone)}
                            className="w-3.5 h-3.5 rounded-full bg-emerald-100 hover:bg-red-200 flex items-center justify-center transition-colors"
                          >
                            <svg className="w-2 h-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
