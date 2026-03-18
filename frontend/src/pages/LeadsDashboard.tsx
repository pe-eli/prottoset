import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LeadSearchForm } from '../features/leads/LeadSearchForm';
import { LeadCard } from '../features/leads/LeadCard';
import { LeadDetailModal } from '../features/leads/LeadDetailModal';
import { LeadPipeline } from '../features/leads/LeadPipeline';
import { SearchLoadingOverlay } from '../features/leads/SearchLoadingOverlay';
import { leadsAPI } from '../features/leads/leads.api';
import { queuesAPI } from '../features/queues/queues.api';
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

  // Nichos únicos para o select
  const niches = useMemo(() => {
    const set = new Set(leads.map((l) => l.niche).filter(Boolean));
    return [...set].sort();
  }, [leads]);

  // Leads filtrados
  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (filters.niche !== 'all' && l.niche !== filters.niche) return false;
      if (filters.priority !== 'all' && l.priority !== filters.priority) return false;
      if (filters.website === 'with' && !l.hasWebsite) return false;
      if (filters.website === 'without' && l.hasWebsite) return false;
      return true;
    });
  }, [leads, filters]);

  const hasActiveFilters = filters.niche !== 'all' || filters.priority !== 'all' || filters.website !== 'all';

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
                ...niches.map((n) => ({ value: n, label: n })),
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
            <div className="flex items-center bg-brand-50 rounded-xl p-0.5">
              <ViewToggle active={view === 'cards'} onClick={() => setView('cards')} label="Cards" />
              <ViewToggle active={view === 'pipeline'} onClick={() => setView('pipeline')} label="Pipeline" />
            </div>
          </div>

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
                  <LeadCard key={lead.id} lead={lead} onClick={setSelectedLead} />
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
