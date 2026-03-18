import type { Lead, LeadStatus, LeadPriority } from './leads.types';

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Novo',
  contacted: 'Contatado',
  replied: 'Respondeu',
  converted: 'Convertido',
  ignored: 'Ignorado',
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  contacted: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  replied: 'bg-purple-50 text-purple-700 border-purple-200',
  converted: 'bg-green-50 text-green-700 border-green-200',
  ignored: 'bg-gray-100 text-gray-500 border-gray-200',
};

const PRIORITY_CONFIG: Record<LeadPriority, { label: string; color: string }> = {
  HIGH: { label: 'Alta', color: 'bg-red-50 text-red-600 border-red-200' },
  MEDIUM: { label: 'Média', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  LOW: { label: 'Baixa', color: 'bg-gray-50 text-gray-500 border-gray-200' },
};

function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

interface LeadCardProps {
  lead: Lead;
  onClick: (lead: Lead) => void;
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const priority = PRIORITY_CONFIG[lead.priority] ?? PRIORITY_CONFIG['LOW'];

  return (
    <button
      type="button"
      onClick={() => onClick(lead)}
      className="w-full text-left bg-surface border border-border-light rounded-2xl p-4 shadow-sm
        hover:shadow-lg hover:shadow-brand-100/50 hover:border-brand-200 hover:-translate-y-0.5
        transition-all duration-200 cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-brand-950 truncate group-hover:text-brand-600 transition-colors">
            {lead.name}
          </h4>
          {lead.neighborhood && (
            <p className="text-xs text-brand-400 mt-0.5">{lead.neighborhood}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${STATUS_COLORS[lead.status] ?? STATUS_COLORS['new']}`}>
            {STATUS_LABELS[lead.status] ?? STATUS_LABELS['new']}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${priority.color}`}>
            {priority.label}
          </span>
        </div>
      </div>

      {/* Info chips */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        <Chip icon="map" text={titleCase(lead.city)} />
        <Chip icon="tag" text={titleCase(lead.niche)} />
        {lead.rating > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-500">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="font-medium">{lead.rating}</span>
          </span>
        )}
      </div>

      {/* Contact row */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        {lead.hasWebsite ? (
          <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg font-medium">
            Com site
          </span>
        ) : (
          <span className="text-[11px] text-red-600 bg-red-50 px-2 py-0.5 rounded-lg font-medium">
            sem site
          </span>
        )}
        {lead.phone && (
          <span className="text-[11px] text-green-600 bg-green-50 px-2 py-0.5 rounded-lg font-medium">
            {lead.phone}
          </span>
        )}
        {lead.email1 && (
          <span className="text-[11px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg font-medium truncate max-w-[160px]">
            {lead.email1}
          </span>
        )}
      </div>
    </button>
  );
}

function Chip({ icon, text }: { icon: string; text: string }) {
  const icons: Record<string, string> = {
    map: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
    tag: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z',
  };

  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-brand-400">
      <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icons[icon]} />
      </svg>
      <span className="truncate max-w-[100px]">{text}</span>
    </span>
  );
}
