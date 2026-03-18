import { useState } from 'react';
import type { Lead, LeadStatus, LeadPriority } from './leads.types';
import { AddToQueueModal } from '../queues/AddToQueueModal';

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
  HIGH: { label: 'Alta prioridade', color: 'bg-red-50 text-red-600 border-red-200' },
  MEDIUM: { label: 'Média prioridade', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  LOW: { label: 'Baixa prioridade', color: 'bg-gray-100 text-gray-500 border-gray-200' },
};

interface LeadDetailModalProps {
  lead: Lead;
  onClose: () => void;
  onStatusChange: (id: string, status: LeadStatus) => void;
  onDelete: (id: string) => void;
}

const NEXT_STATUS: Partial<Record<LeadStatus, { status: LeadStatus; label: string; color: string }>> = {
  new: { status: 'contacted', label: 'Marcar como Contatado', color: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
  contacted: { status: 'replied', label: 'Marcar como Respondeu', color: 'bg-purple-500 hover:bg-purple-600 text-white' },
  replied: { status: 'converted', label: 'Converter Lead', color: 'bg-green-500 hover:bg-green-600 text-white' },
};

export function LeadDetailModal({ lead, onClose, onStatusChange, onDelete }: LeadDetailModalProps) {
  const [showAddToQueue, setShowAddToQueue] = useState(false);
  const next = NEXT_STATUS[lead.status ?? 'new'];
  const priority = PRIORITY_CONFIG[lead.priority] ?? PRIORITY_CONFIG['LOW'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-brand-950/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div className="relative bg-surface rounded-2xl shadow-2xl shadow-brand-500/10 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up border border-border-light">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-brand-50 hover:bg-brand-100 flex items-center justify-center transition-colors"
        >
          <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6 space-y-5">
          {/* Header */}
          <div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-400 flex items-center justify-center shrink-0 shadow-sm shadow-brand-500/20">
                <span className="text-white font-bold text-sm">
                  {lead.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-brand-950">{lead.name}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold border ${STATUS_COLORS[lead.status] ?? STATUS_COLORS['new']}`}>
                    {STATUS_LABELS[lead.status] ?? STATUS_LABELS['new']}
                  </span>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold border ${priority.color}`}>
                    {priority.label}
                  </span>
                  {lead.rating > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-amber-500 font-medium">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {lead.rating}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoField label="Nicho" value={lead.niche} />
            <InfoField label="Cidade" value={lead.city} />
            <InfoField label="Bairro" value={lead.neighborhood} />
            <InfoField
              label="Website"
              value={lead.hasWebsite ? 'Sim' : 'Sem site'}
              highlight={!lead.hasWebsite}
            />
          </div>

          {/* Address */}
          {lead.address && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-brand-400 uppercase tracking-widest">Endereço</h4>
              <p className="text-sm text-brand-900 bg-surface-secondary rounded-xl px-3 py-2 border border-border-light">
                {lead.address}
              </p>
            </div>
          )}

          {/* Links */}
          {lead.website && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-brand-400 uppercase tracking-widest">Website</h4>
              <div className="space-y-1.5">
                <LinkRow label={safeHostname(lead.website)} href={lead.website} />
              </div>
            </div>
          )}

          {/* Contact info */}
          {(lead.phone || lead.email1 || lead.email2) && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-brand-400 uppercase tracking-widest">Contato</h4>
              <div className="space-y-1.5">
                {lead.phone && (
                  <div className="flex items-center gap-2.5 bg-green-50 rounded-xl px-3 py-2">
                    <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span className="text-sm text-green-800 font-medium flex-1">{lead.phone}</span>
                    <button
                      onClick={() => setShowAddToQueue(true)}
                      title="Adicionar a uma fila de disparo"
                      className="w-6 h-6 rounded-lg bg-green-100 hover:bg-green-200 flex items-center justify-center transition-colors shrink-0"
                    >
                      <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                )}
                {lead.email1 && (
                  <div className="flex items-center gap-2.5 bg-orange-50 rounded-xl px-3 py-2">
                    <svg className="w-4 h-4 text-orange-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <a href={`mailto:${lead.email1}`} className="text-sm text-orange-800 font-medium hover:underline">
                      {lead.email1}
                    </a>
                  </div>
                )}
                {lead.email2 && (
                  <div className="flex items-center gap-2.5 bg-orange-50 rounded-xl px-3 py-2">
                    <svg className="w-4 h-4 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <a href={`mailto:${lead.email2}`} className="text-sm text-orange-700 font-medium hover:underline">
                      {lead.email2}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border-light">
            {next && (
              <button
                onClick={() => onStatusChange(lead.id, next.status)}
                className={`flex-1 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors ${next.color}`}
              >
                {next.label}
              </button>
            )}
            {lead.status !== 'ignored' && lead.status !== 'converted' && (
              <button
                onClick={() => onStatusChange(lead.id, 'ignored')}
                className="text-sm px-4 py-2.5 rounded-xl border border-border text-brand-400 hover:bg-brand-50 transition-colors font-medium"
              >
                Ignorar
              </button>
            )}
            <button
              onClick={() => {
                onDelete(lead.id);
                onClose();
              }}
              className="text-sm px-4 py-2.5 rounded-xl border border-red-200 text-red-400 hover:bg-red-50 transition-colors font-medium"
            >
              Excluir
            </button>
          </div>
        </div>
      </div>

      {showAddToQueue && lead.phone && (
        <AddToQueueModal
          phone={lead.phone}
          onClose={() => setShowAddToQueue(false)}
        />
      )}
    </div>
  );
}

function InfoField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 border ${highlight ? 'bg-red-50/50 border-red-200' : 'bg-surface-secondary border-border-light'}`}>
      <p className="text-[10px] text-brand-300 uppercase tracking-wide font-semibold">{label}</p>
      <p className={`text-sm font-medium mt-0.5 ${highlight ? 'text-red-600' : 'text-brand-900'}`}>{value || '—'}</p>
    </div>
  );
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function LinkRow({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 bg-surface-secondary hover:bg-brand-50/50 rounded-xl px-3 py-2 transition-colors group border border-border-light"
    >
      <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
      </svg>
      <span className="text-sm font-medium text-blue-600 group-hover:underline truncate">{label}</span>
      <svg className="w-3 h-3 text-brand-300 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}
