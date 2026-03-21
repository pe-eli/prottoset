import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LeadSearchForm } from '../features/leads/LeadSearchForm';
import { LeadCard } from '../features/leads/LeadCard';
import { LeadDetailModal } from '../features/leads/LeadDetailModal';
import { LeadPipeline } from '../features/leads/LeadPipeline';
import { SearchLoadingOverlay } from '../features/leads/SearchLoadingOverlay';
import { leadsAPI } from '../features/leads/leads.api';
import { queuesAPI } from '../features/queues/queues.api';
import { AddToQueueModal } from '../features/queues/AddToQueueModal';
import type { Lead, LeadSearchParams, LeadMetrics, LeadStatus, LeadPriority } from '../features/leads/leads.types';

type ViewMode = 'cards' | 'pipeline';
type WebsiteFilter = 'all' | 'with' | 'without';

interface Filters {
  niche: string;
  priority: LeadPriority | 'all';
  website: WebsiteFilter;
}

export function LeadsDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [view, setView] = useState<ViewMode>('cards');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [lastResult, setLastResult] = useState<{ saved: number; duplicates: number; metrics: LeadMetrics } | null>(null);
  const [filters, setFilters] = useState<Filters>({ niche: 'all', priority: 'all', website: 'all' });
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkQueue, setShowBulkQueue] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Nichos únicos para o select (case-insensitive)
  const niches = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach((l) => {
      if (l.niche) {
        const key = l.niche.toLowerCase();
        if (!map.has(key)) {
          // Armazena versão title-case como label
          map.set(key, l.niche.replace(/\b\w/g, (c) => c.toUpperCase()));
        }
      }
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, label]) => ({ value, label }));
  }, [leads]);

  // Leads filtrados
  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (filters.niche !== 'all' && l.niche.toLowerCase() !== filters.niche) return false;
      if (filters.priority !== 'all' && l.priority !== filters.priority) return false;
      if (filters.website === 'with' && !l.hasWebsite) return false;
      if (filters.website === 'without' && l.hasWebsite) return false;
      return true;
    });
  }, [leads, filters]);

  const hasActiveFilters = filters.niche !== 'all' || filters.priority !== 'all' || filters.website !== 'all';

  const filteredWithPhone = useMemo(() => filtered.filter((l) => l.phone), [filtered]);

  const toggleSelect = (lead: Lead) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(lead.id)) next.delete(lead.id);
      else next.add(lead.id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredWithPhone.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredWithPhone.map((l) => l.id)));
    }
  };

  const exitSelection = () => {
    setSelecting(false);
    setSelectedIds(new Set());
  };

  const selectedPhones = useMemo(() => {
    return filtered
      .filter((l) => selectedIds.has(l.id) && l.phone)
      .map((l) => l.phone!);
  }, [filtered, selectedIds]);

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Excluir ${selectedIds.size} lead(s) selecionado(s)?`)) return;
    setDeleting(true);
    try {
      await Promise.all([...selectedIds].map((id) => leadsAPI.delete(id)));
      setLeads((prev) => prev.filter((l) => !selectedIds.has(l.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to delete leads:', err);
    } finally {
      setDeleting(false);
    }
  };

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await leadsAPI.getAll();
      setLeads(data);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleSearch = async (params: LeadSearchParams, queueId?: string) => {
    setSearchLoading(true);
    setLastResult(null);
    try {
      const { data } = await leadsAPI.search(params);
      setLastResult({
        saved: data.saved.length,
        duplicates: data.duplicates,
        metrics: data.metrics,
      });

      // Auto-add phones to queue
      if (queueId && data.saved.length > 0) {
        const phones = data.saved.map((l) => l.phone).filter(Boolean);
        if (phones.length > 0) {
          await queuesAPI.addPhones(queueId, phones).catch(() => {});
        }
      }

      await fetchLeads();
    } catch (err: any) {
      const message = err.response?.data?.error || 'Erro ao buscar leads';
      alert(message);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    try {
      const { data } = await leadsAPI.updateStatus(id, status);
      setLeads((prev) => prev.map((l) => (l.id === id ? data : l)));
      if (selectedLead?.id === id) setSelectedLead(data);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await leadsAPI.delete(id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      console.error('Failed to delete lead:', err);
    }
  };

  const stats = {
    total: leads.length,
    semSite: leads.filter((l) => !l.hasWebsite).length,
    altaPrioridade: leads.filter((l) => l.priority === 'HIGH').length,
    converted: leads.filter((l) => l.status === 'converted').length,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/leads"
            className="w-9 h-9 rounded-xl bg-brand-50 hover:bg-brand-100 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-brand-950">Prospecção de Leads</h2>
            <p className="text-sm text-brand-400">Busque leads via Google Maps e extraia contatos</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} gradient="from-brand-600 to-brand-400" />
        <StatCard label="Sem site" value={stats.semSite} gradient="from-red-500 to-rose-400" />
        <StatCard label="Alta prioridade" value={stats.altaPrioridade} gradient="from-amber-500 to-yellow-400" />
        <StatCard label="Convertidos" value={stats.converted} gradient="from-emerald-500 to-teal-400" />
      </div>

      {/* Search Form */}
      <LeadSearchForm onSearch={handleSearch} loading={searchLoading} />

      {/* Loading animation */}
      {searchLoading && <SearchLoadingOverlay />}

      {/* Search result feedback */}
      {lastResult && !searchLoading && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl px-5 py-4 text-sm animate-fade-in space-y-2">
          <p className="text-emerald-800 font-medium">
            <strong>{lastResult.saved}</strong> novos leads salvos
            {lastResult.duplicates > 0 && (
              <span className="text-emerald-600"> ({lastResult.duplicates} duplicados ignorados)</span>
            )}
          </p>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-emerald-700">
              Total encontrados: <strong>{lastResult.metrics.totalLeads}</strong>
            </span>
            <span className="text-red-600">
              Sem site: <strong>{lastResult.metrics.leadsSemWebsite}</strong>
            </span>
            <span className="text-blue-600">
              Com site: <strong>{lastResult.metrics.leadsComWebsite}</strong>
            </span>
            <span className="text-amber-600">
              Alta prioridade: <strong>{lastResult.metrics.leadsAltaPrioridade}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      {!searchLoading && leads.length > 0 && (
        <div className="bg-surface border border-border-light rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-brand-400 uppercase tracking-widest flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtros
            </h4>
            {hasActiveFilters && (
              <button
                onClick={() => setFilters({ niche: 'all', priority: 'all', website: 'all' })}
                className="text-[11px] text-brand-400 hover:text-brand-600 font-medium transition-colors"
              >
                Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FilterSelect
              label="Nicho"
              value={filters.niche}
              onChange={(v) => setFilters((f) => ({ ...f, niche: v }))}
              options={[
                { value: 'all', label: 'Todos os nichos' },
                ...niches,
              ]}
            />
            <FilterSelect
              label="Prioridade"
              value={filters.priority}
              onChange={(v) => setFilters((f) => ({ ...f, priority: v as Filters['priority'] }))}
              options={[
                { value: 'all', label: 'Todas' },
                { value: 'HIGH', label: 'Alta' },
                { value: 'MEDIUM', label: 'Média' },
                { value: 'LOW', label: 'Baixa' },
              ]}
            />
            <FilterSelect
              label="Website"
              value={filters.website}
              onChange={(v) => setFilters((f) => ({ ...f, website: v as WebsiteFilter }))}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'without', label: 'Sem site' },
                { value: 'with', label: 'Com site' },
              ]}
            />
          </div>
        </div>
      )}

      {/* View toggle + Lead list */}
      {!searchLoading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-widest">
              Leads ({filtered.length}{hasActiveFilters ? ` de ${leads.length}` : ''})
            </h3>
            <div className="flex items-center gap-2">
              {view === 'cards' && filtered.length > 0 && (
                <button
                  onClick={() => selecting ? exitSelection() : setSelecting(true)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-200 font-semibold ${
                    selecting
                      ? 'bg-brand-600 text-white'
                      : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                  }`}
                >
                  {selecting ? 'Cancelar' : 'Selecionar'}
                </button>
              )}
              <div className="flex items-center bg-brand-50 rounded-xl p-0.5">
                <ViewToggle active={view === 'cards'} onClick={() => { setView('cards'); }} label="Cards" />
                <ViewToggle active={view === 'pipeline'} onClick={() => { setView('pipeline'); exitSelection(); }} label="Pipeline" />
              </div>
            </div>
          </div>

          {/* Selection bar */}
          {selecting && view === 'cards' && filtered.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-brand-50 border border-brand-100 rounded-xl animate-fade-in">
              <div className="flex items-center gap-3">
                <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs font-semibold text-brand-700 hover:text-brand-900 transition-colors">
                  <div className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-all ${
                    selectedIds.size === filteredWithPhone.length && filteredWithPhone.length > 0
                      ? 'bg-brand-600 border-brand-600'
                      : 'bg-white border-brand-300'
                  }`}>
                    {selectedIds.size === filteredWithPhone.length && filteredWithPhone.length > 0 && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  Selecionar todos
                </button>
                <span className="text-xs text-brand-400">
                  {selectedIds.size} {selectedIds.size === 1 ? 'selecionado' : 'selecionados'}
                </span>
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowBulkQueue(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Fila ({selectedPhones.length})
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {deleting ? 'Excluindo...' : `Excluir (${selectedIds.size})`}
                  </button>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-sm text-brand-300">Carregando leads...</div>
          ) : view === 'cards' ? (
            filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-3xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-sm text-brand-400">
                  {hasActiveFilters ? 'Nenhum lead encontrado com esses filtros' : 'Nenhum lead encontrado'}
                </p>
                {hasActiveFilters ? (
                  <button
                    onClick={() => setFilters({ niche: 'all', priority: 'all', website: 'all' })}
                    className="text-xs text-brand-500 hover:text-brand-700 mt-2 font-medium transition-colors"
                  >
                    Limpar filtros
                  </button>
                ) : (
                  <p className="text-xs text-brand-300 mt-1">Use a busca acima para prospectar novos leads</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onClick={setSelectedLead}
                    selectable={selecting && !!lead.phone}
                    selected={selectedIds.has(lead.id)}
                    onToggle={toggleSelect}
                  />
                ))}
              </div>
            )
          ) : (
            <LeadPipeline leads={filtered} onStatusChange={handleStatusChange} />
          )}
        </div>
      )}

      {/* Detail modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      )}

      {/* Bulk add to queue */}
      {showBulkQueue && selectedPhones.length > 0 && (
        <AddToQueueModal
          phones={selectedPhones}
          onClose={() => setShowBulkQueue(false)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, gradient }: { label: string; value: number; gradient: string }) {
  return (
    <div className="bg-surface border border-border-light rounded-2xl shadow-sm p-4 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${gradient} opacity-5 rounded-bl-[3rem]`} />
      <p className="text-xs text-brand-400 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>{value}</p>
    </div>
  );
}

function ViewToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-4 py-1.5 rounded-lg transition-all duration-200 font-semibold ${
        active
          ? 'bg-white text-brand-700 shadow-sm'
          : 'text-brand-400 hover:text-brand-600'
      }`}
    >
      {label}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-brand-300 uppercase tracking-wide mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950
          focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400
          transition-all duration-200 appearance-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
