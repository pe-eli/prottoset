import type { Lead, LeadStatus, LeadPriority } from './leads.types';

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Novo',
  contacted: 'Contatado',
  replied: 'Respondeu',
  converted: 'Convertido',
  ignored: 'Ignorado',
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-500/15 text-blue-200 border-blue-400/30',
  contacted: 'bg-amber-500/15 text-amber-200 border-amber-400/35',
  replied: 'bg-indigo-500/15 text-indigo-200 border-indigo-400/35',
  converted: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/35',
  ignored: 'bg-slate-500/15 text-slate-300 border-slate-400/30',
};

const PRIORITY_SURFACE: Record<LeadPriority, string> = {
  HIGH: 'bg-surface border-red-400/30 hover:border-red-300/45',
  MEDIUM: 'bg-surface border-amber-400/30 hover:border-amber-300/45',
  LOW: 'bg-surface border-border-light hover:border-brand-400/35',
};

function titleCase(str: string): string {
  return str
    .trim()
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1))
    .join(' ');
}

function normalizeWebsite(url: string): string {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function formatWebsiteLabel(url: string): string {
  return normalizeWebsite(url)
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

interface LeadCardProps {
  lead: Lead;
  onClick: (lead: Lead) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: (lead: Lead) => void;
}

export function LeadCard({ lead, onClick, selectable, selected, onToggle }: LeadCardProps) {
  const prioritySurface = PRIORITY_SURFACE[lead.priority] ?? PRIORITY_SURFACE['LOW'];

  const handleCardClick = () => {
    if (selectable && onToggle) {
      onToggle(lead);
      return;
    }
    onClick(lead);
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCardClick();
    }
  };

  const handleCopyPhone = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(lead.phone);
    } catch {
      // Ignore clipboard failures to avoid blocking card interactions.
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className={`w-full text-left border rounded-2xl p-4 shadow-sm
        hover:shadow-lg hover:shadow-black/25 hover:-translate-y-0.5
        transition-all duration-200 cursor-pointer group relative outline-none
        ${selected ? 'bg-surface border-brand-400 ring-2 ring-brand-400/30' : prioritySurface}`}
    >
      {/* Selection checkbox */}
      {selectable && (
        <div className={`absolute top-3 left-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
          ${selected
            ? 'bg-brand-600 border-brand-600'
            : 'bg-surface-secondary border-border-light group-hover:border-brand-400/60'}`}
        >
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-text-primary truncate group-hover:text-brand-200 transition-colors">
            {lead.name}
          </h4>
          {lead.neighborhood && (
            <p className="text-xs text-text-muted mt-0.5">{lead.neighborhood}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${STATUS_COLORS[lead.status] ?? STATUS_COLORS['new']}`}>
            {STATUS_LABELS[lead.status] ?? STATUS_LABELS['new']}
          </span>
        </div>
      </div>

      {/* Info chips */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        <Chip icon="map" text={titleCase(lead.city)} />
        <Chip icon="tag" text={titleCase(lead.niche)} />
        {lead.rating > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-300">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="font-medium">{lead.rating}</span>
          </span>
        )}
      </div>

      {/* Contact row */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        {lead.hasWebsite && lead.website ? (
          <>
            <a
              href={normalizeWebsite(lead.website)}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-[11px] text-blue-200 bg-blue-500/15 border border-blue-400/30 px-2.5 py-1 rounded-lg font-medium max-w-[220px] hover:bg-blue-500/20 transition-colors"
              title={normalizeWebsite(lead.website)}
            >
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5m12.156-1.5l-1.5 1.5a4 4 0 01-5.656-5.656l3-3a4 4 0 115.656 5.656z" />
              </svg>
              <span className="truncate">{formatWebsiteLabel(lead.website)}</span>
            </a>

            {lead.websiteFetchError && (
              <span className="inline-flex items-center gap-1 text-[11px] text-rose-200 bg-rose-500/15 border border-rose-400/35 px-2 py-0.5 rounded-lg font-semibold">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-7.938 4h15.876c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L2.33 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Site fora do ar
              </span>
            )}
          </>
        ) : (
          <span className="text-[11px] text-rose-200 bg-rose-500/15 border border-rose-400/30 px-2 py-0.5 rounded-lg font-medium">
            Sem site
          </span>
        )}
        {lead.phone && (
          <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-lg font-medium text-[11px]">
            <span>{lead.phone}</span>
            <button
              type="button"
              onClick={handleCopyPhone}
              className="w-4 h-4 rounded-md flex items-center justify-center hover:bg-emerald-500/25 transition-colors"
              title="Copiar telefone"
              aria-label="Copiar telefone"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V5a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2h-2m-4 4H6a2 2 0 01-2-2v-8a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2z" />
              </svg>
            </button>
          </span>
        )}
        {lead.email1 && (
          <span className="text-[11px] text-amber-200 bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 rounded-lg font-medium truncate max-w-[160px]">
            {lead.email1}
          </span>
        )}
      </div>
    </div>
  );
}

function Chip({ icon, text }: { icon: string; text: string }) {
  const icons: Record<string, string> = {
    map: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
    tag: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z',
  };

  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary">
      <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icons[icon]} />
      </svg>
      <span className="truncate max-w-[100px]">{text}</span>
    </span>
  );
}
