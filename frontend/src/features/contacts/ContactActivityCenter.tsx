import { useState, useEffect, useCallback } from 'react';
import { contactsAPI, type Contact, type ContactActivity, type ContactStatus } from './contacts.api';

// ─── Status config ────────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<ContactStatus, { label: string; color: string; bg: string; dot: string }> = {
  new: { label: 'Novo', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  contacted: { label: 'Contato iniciado', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  no_reply: { label: 'Sem resposta', color: 'text-gray-600', bg: 'bg-gray-100 border-gray-300', dot: 'bg-gray-400' },
  interested: { label: 'Interessado', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200', dot: 'bg-cyan-500' },
  negotiating: { label: 'Em negociação', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500' },
  client: { label: 'Fechado', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  lost: { label: 'Perdido', color: 'text-red-600', bg: 'bg-red-50 border-red-200', dot: 'bg-red-400' },
};

export const STATUS_OPTIONS: ContactStatus[] = [
  'new', 'contacted', 'no_reply', 'interested', 'negotiating', 'client', 'lost',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `${diffMins}min atrás`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatScheduledDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86_400_000);
  if (diffDays < 0) return `Atrasado ${Math.abs(diffDays)} dia${Math.abs(diffDays) > 1 ? 's' : ''}`;
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function buildWhatsAppLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}`;
}

function getInitials(contact: Contact): string {
  const name = contact.name || contact.email || contact.phone || '?';
  return name.charAt(0).toUpperCase();
}

// ─── Activity config ──────────────────────────────────────────────────────────

type ActivityConfig = { icon: React.ReactNode; color: string; bg: string };

const ACTIVITY_CONFIG: Record<string, ActivityConfig> = {
  MESSAGE_SENT: {
    bg: 'bg-emerald-500/10 border-emerald-400/30',
    color: 'text-emerald-400',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  },
  FOLLOWUP_CREATED: {
    bg: 'bg-amber-500/10 border-amber-400/30',
    color: 'text-amber-400',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  NOTE_CREATED: {
    bg: 'bg-blue-500/10 border-blue-400/30',
    color: 'text-blue-400',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  STATUS_CHANGED: {
    bg: 'bg-purple-500/10 border-purple-400/30',
    color: 'text-purple-400',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
  },
  CAMPAIGN_SENT: {
    bg: 'bg-indigo-500/10 border-indigo-400/30',
    color: 'text-indigo-400',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
  },
  CONTACT_CREATED: {
    bg: 'bg-teal-500/10 border-teal-400/30',
    color: 'text-teal-400',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
  },
  MANUAL_INTERACTION: {
    bg: 'bg-brand-500/10 border-brand-400/30',
    color: 'text-brand-400',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
};

function getActivityConfig(type: string): ActivityConfig {
  return ACTIVITY_CONFIG[type] ?? ACTIVITY_CONFIG.MANUAL_INTERACTION;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ContactHeader({ contact, onStatusChange, saving }: {
  contact: Contact;
  onStatusChange: (status: ContactStatus) => void;
  saving: boolean;
}) {
  const statusCfg = STATUS_CONFIG[contact.status] ?? STATUS_CONFIG.new;
  const displayName = contact.name || contact.email || contact.phone || 'Contato';
  const phone = contact.phone;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/20">
          <span className="text-white font-bold text-xl">{getInitials(contact)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-text-primary truncate">{displayName}</h2>
          {contact.company && (
            <p className="text-sm text-text-secondary">{contact.company}</p>
          )}
          {phone && (
            <p className="text-xs text-text-muted font-mono mt-0.5">+{phone.replace(/\D/g, '')}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border ${statusCfg.bg} ${statusCfg.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
          {statusCfg.label}
        </span>

        {contact.channel && (
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold border border-border bg-surface-secondary text-text-secondary">
            {contact.channel === 'whatsapp' ? 'WhatsApp' : contact.channel === 'email' ? 'Email' : 'Manual'}
          </span>
        )}

        {contact.lastMessageAt && (
          <span className="text-xs text-text-muted">
            Última interação: {formatDate(contact.lastMessageAt)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-text-secondary font-medium shrink-0">Status:</label>
        <select
          value={contact.status}
          onChange={(e) => onStatusChange(e.target.value as ContactStatus)}
          disabled={saving}
          className="flex-1 text-xs px-2.5 py-1.5 bg-surface-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-400/40 cursor-pointer"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function QuickActions({ contact, onSendMessage }: { contact: Contact; onSendMessage: () => void }) {
  const phone = contact.phone?.replace(/\D/g, '') || '';

  const copyPhone = () => {
    if (phone) {
      navigator.clipboard.writeText(`+${phone}`).catch(() => {});
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={onSendMessage}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors font-semibold"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
        Enviar mensagem
      </button>

      {phone && (
        <a
          href={buildWhatsAppLink(phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-400/30 text-green-300 hover:bg-green-500/25 transition-colors font-semibold"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Abrir no WhatsApp
        </a>
      )}

      {phone && (
        <button
          onClick={copyPhone}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-secondary border border-border text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors font-semibold"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copiar telefone
        </button>
      )}
    </div>
  );
}

function ActivityTimeline({ activities, onFollowupToggle }: {
  activities: ContactActivity[];
  onFollowupToggle: (activityId: string, done: boolean) => void;
}) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-xs text-text-muted">Nenhuma atividade ainda</p>
        <p className="text-xs text-text-muted/60 mt-1">As interações aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((activity, index) => {
        const cfg = getActivityConfig(activity.type);
        const isFollowup = activity.type === 'FOLLOWUP_CREATED';
        const done = Boolean(activity.metadata?.done);
        const scheduledFor = typeof activity.metadata?.scheduledFor === 'string'
          ? activity.metadata.scheduledFor
          : null;
        const isOverdue = isFollowup && !done && scheduledFor && new Date(scheduledFor) < new Date();

        return (
          <div key={activity.id} className="relative flex gap-3">
            {/* Timeline line */}
            {index < activities.length - 1 && (
              <div className="absolute left-4 top-8 bottom-0 w-px bg-border-light" />
            )}

            {/* Icon */}
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${cfg.bg} ${cfg.color} z-10`}>
              {cfg.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                    {activity.title}
                    {isOverdue && !done && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-400/30 text-red-400 font-bold no-underline">
                        Atrasado
                      </span>
                    )}
                  </p>
                  {activity.description && (
                    <p className="text-xs text-text-secondary mt-0.5 whitespace-pre-wrap leading-relaxed">
                      {activity.description}
                    </p>
                  )}
                  {isFollowup && scheduledFor && (
                    <p className={`text-xs mt-1 font-medium ${isOverdue && !done ? 'text-red-400' : 'text-amber-400'}`}>
                      {formatScheduledDate(scheduledFor)} —{' '}
                      {new Date(scheduledFor).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  {activity.type === 'STATUS_CHANGED' && activity.metadata?.from && activity.metadata?.to && (
                    <p className="text-xs text-text-muted mt-0.5">
                      {STATUS_CONFIG[activity.metadata.from as ContactStatus]?.label ?? String(activity.metadata.from)}
                      {' → '}
                      {STATUS_CONFIG[activity.metadata.to as ContactStatus]?.label ?? String(activity.metadata.to)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-text-muted whitespace-nowrap">{formatDate(activity.createdAt)}</span>
                  {isFollowup && (
                    <button
                      onClick={() => onFollowupToggle(activity.id, !done)}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        done
                          ? 'bg-emerald-500 border-emerald-400 text-white'
                          : 'border-border hover:border-emerald-400 text-transparent hover:text-emerald-400'
                      }`}
                      title={done ? 'Marcar como pendente' : 'Marcar como concluído'}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddNoteForm({ onAdd }: { onAdd: (content: string) => Promise<void> }) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onAdd(trimmed);
      setContent('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Adicionar observação interna..."
        className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-brand-400/40"
        maxLength={2000}
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-muted">{content.length}/2000</span>
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || saving}
          className="text-xs px-3 py-1.5 rounded-lg bg-brand-500/15 border border-brand-400/30 text-brand-300 hover:bg-brand-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
        >
          {saving ? 'Salvando...' : 'Adicionar nota'}
        </button>
      </div>
    </div>
  );
}

function ScheduleFollowupForm({ onSchedule }: { onSchedule: (date: string, note: string, priority: 'low' | 'normal' | 'high') => Promise<void> }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSubmit = async () => {
    if (!date) return;
    const scheduledFor = `${date}T${time}:00`;
    setSaving(true);
    try {
      await onSchedule(scheduledFor, note, priority);
      setDate('');
      setTime('09:00');
      setNote('');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-xs px-3 py-2 rounded-xl border border-dashed border-amber-400/40 text-amber-400 hover:bg-amber-500/10 transition-colors font-semibold"
      >
        + Agendar follow-up
      </button>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3 p-3 bg-amber-500/5 border border-amber-400/20 rounded-xl">
      <p className="text-xs font-semibold text-amber-300">Agendar follow-up</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
          className="px-2.5 py-1.5 bg-surface-secondary border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-amber-400/40"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="px-2.5 py-1.5 bg-surface-secondary border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-amber-400/40"
        />
      </div>
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as 'low' | 'normal' | 'high')}
        className="w-full px-2.5 py-1.5 bg-surface-secondary border border-border rounded-lg text-xs text-text-primary"
      >
        <option value="low">Prioridade baixa</option>
        <option value="normal">Prioridade normal</option>
        <option value="high">Prioridade alta</option>
      </select>
      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Lembrete (opcional)"
        className="w-full px-2.5 py-1.5 bg-surface-secondary border border-border rounded-lg text-xs text-text-primary resize-none focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => setOpen(false)}
          className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-surface-secondary border border-border text-text-secondary hover:text-text-primary transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!date || saving}
          className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 transition-colors font-semibold"
        >
          {saving ? 'Agendando...' : 'Agendar'}
        </button>
      </div>
    </div>
  );
}

function EditContactForm({ contact, onSave, onDelete }: {
  contact: Contact;
  onSave: (data: Partial<Contact>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: contact.name, phone: contact.phone, company: contact.company, notes: contact.notes });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Excluir este contato? Esta ação não pode ser desfeita.')) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-secondary border border-border text-text-secondary hover:text-text-primary transition-colors font-semibold"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Editar contato
      </button>
    );
  }

  return (
    <div className="space-y-3 p-3 bg-surface-secondary border border-border rounded-xl">
      <p className="text-xs font-semibold text-text-primary">Editar contato</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="Nome"
          className="px-2.5 py-1.5 bg-surface border border-border rounded-lg text-xs text-text-primary"
        />
        <input
          value={form.phone}
          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          placeholder="Telefone"
          className="px-2.5 py-1.5 bg-surface border border-border rounded-lg text-xs text-text-primary"
        />
        <input
          value={form.company}
          onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
          placeholder="Empresa"
          className="col-span-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-xs text-text-primary"
        />
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder="Observações gerais"
          className="col-span-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-xs text-text-primary resize-none"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setOpen(false)}
          className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-brand-500/20 border border-brand-400/40 text-brand-300 hover:bg-brand-500/30 disabled:opacity-40 transition-colors font-semibold"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-400/30 text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
        >
          {deleting ? '...' : 'Excluir'}
        </button>
      </div>
    </div>
  );
}

// ─── SendMessageModal ─────────────────────────────────────────────────────────

function SendMessageModal({ contact, onClose, onSent }: {
  contact: Contact;
  onClose: () => void;
  onSent: () => void;
}) {
  const [mode, setMode] = useState<'ai' | 'manual'>('manual');
  const [message, setMessage] = useState('');
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      await contactsAPI.replyWhatsapp(contact.id, {
        messageMode: mode,
        promptBase: mode === 'ai' ? prompt : undefined,
        manualMessage: mode === 'manual' ? message : undefined,
      });
      onSent();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl border border-border-light shadow-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary">Enviar mensagem WhatsApp</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-surface-secondary hover:bg-surface-elevated flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-1 bg-surface-secondary border border-border rounded-xl p-1">
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 text-xs py-1.5 rounded-lg font-semibold transition-all ${mode === 'manual' ? 'bg-surface text-text-primary border border-border shadow-sm' : 'text-text-secondary'}`}
          >
            Mensagem fixa
          </button>
          <button
            onClick={() => setMode('ai')}
            className={`flex-1 text-xs py-1.5 rounded-lg font-semibold transition-all ${mode === 'ai' ? 'bg-surface text-text-primary border border-border shadow-sm' : 'text-text-secondary'}`}
          >
            Gerar com IA
          </button>
        </div>

        {mode === 'manual' ? (
          <textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite a mensagem..."
            className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-brand-400/40"
          />
        ) : (
          <textarea
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Descreva o prompt para gerar a mensagem com IA..."
            className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-brand-400/40"
          />
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 text-xs px-3 py-2 rounded-lg bg-surface-secondary border border-border text-text-secondary hover:text-text-primary transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sending || (mode === 'manual' ? !message.trim() : !prompt.trim())}
            className="flex-1 text-xs px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40 transition-colors font-semibold"
          >
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ContactActivityCenterProps {
  contact: Contact;
  onClose: () => void;
  onUpdated: (contact: Contact) => void;
  onDeleted: (id: string) => void;
}

export function ContactActivityCenter({ contact, onClose, onUpdated, onDeleted }: ContactActivityCenterProps) {
  const [current, setCurrent] = useState<Contact>(contact);
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [showSendMessage, setShowSendMessage] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'followups' | 'notes'>('timeline');

  const loadActivities = useCallback(async () => {
    try {
      const { data } = await contactsAPI.getActivities(current.id);
      setActivities(Array.isArray(data) ? data : []);
    } catch {
      // silently fail
    } finally {
      setLoadingActivities(false);
    }
  }, [current.id]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const handleStatusChange = async (status: ContactStatus) => {
    setSavingStatus(true);
    try {
      const { data } = await contactsAPI.update(current.id, { status });
      setCurrent(data);
      onUpdated(data);
    } catch {
      // silently fail
    } finally {
      setSavingStatus(false);
    }
  };

  const handleAddNote = async (content: string) => {
    const { data } = await contactsAPI.addNote(current.id, content);
    setActivities((prev) => [...prev, data]);
  };

  const handleScheduleFollowup = async (scheduledFor: string, note: string, priority: 'low' | 'normal' | 'high') => {
    const { data } = await contactsAPI.createFollowup(current.id, { scheduledFor, note, priority });
    setActivities((prev) => [...prev, data]);
  };

  const handleFollowupToggle = async (activityId: string, done: boolean) => {
    try {
      const { data } = await contactsAPI.completeFollowup(current.id, activityId, done);
      setActivities((prev) => prev.map((a) => a.id === activityId ? data : a));
    } catch {
      // silently fail
    }
  };

  const handleSaveContact = async (formData: Partial<Contact>) => {
    const { data } = await contactsAPI.update(current.id, formData);
    setCurrent(data);
    onUpdated(data);
  };

  const handleDelete = async () => {
    await contactsAPI.delete(current.id);
    onDeleted(current.id);
    onClose();
  };

  const followups = activities.filter((a) => a.type === 'FOLLOWUP_CREATED');
  const pendingFollowups = followups.filter((a) => !a.metadata?.done);
  const overdueFollowups = pendingFollowups.filter((a) => {
    const scheduled = a.metadata?.scheduledFor;
    return typeof scheduled === 'string' && new Date(scheduled) < new Date();
  });

  const timelineActivities = activities;
  const notes = activities.filter((a) => a.type === 'NOTE_CREATED');

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end">
        <div className="absolute inset-0 bg-brand-950/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-surface border-l border-border shadow-2xl w-full max-w-lg flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="w-8 h-8 rounded-xl bg-surface-secondary hover:bg-surface-elevated flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-bold text-text-primary">Contact Activity Center</span>
            </div>
            {overdueFollowups.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 border border-red-400/30 text-red-400 font-bold">
                {overdueFollowups.length} atrasado{overdueFollowups.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Contact header + quick actions */}
            <ContactHeader contact={current} onStatusChange={handleStatusChange} saving={savingStatus} />

            <QuickActions contact={current} onSendMessage={() => setShowSendMessage(true)} />

            <EditContactForm contact={current} onSave={handleSaveContact} onDelete={handleDelete} />

            <div className="border-t border-border" />

            {/* Tab bar */}
            <div className="flex items-center gap-1 bg-surface-secondary border border-border rounded-xl p-1">
              {([
                { key: 'timeline', label: 'Timeline', count: activities.length },
                { key: 'followups', label: 'Follow-ups', count: pendingFollowups.length },
                { key: 'notes', label: 'Notas', count: notes.length },
              ] as const).map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg font-semibold transition-all ${
                    activeTab === key
                      ? 'bg-surface text-text-primary border border-border shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      activeTab === key ? 'bg-brand-400/15 text-brand-200' : 'bg-brand-400/10 text-brand-300'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'timeline' && (
              <div>
                {loadingActivities ? (
                  <div className="text-center py-6">
                    <div className="h-5 w-5 rounded-full border-2 border-border border-t-brand-400 animate-spin mx-auto" />
                  </div>
                ) : (
                  <ActivityTimeline activities={timelineActivities} onFollowupToggle={handleFollowupToggle} />
                )}
              </div>
            )}

            {activeTab === 'followups' && (
              <div className="space-y-4">
                <ScheduleFollowupForm onSchedule={handleScheduleFollowup} />
                {followups.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-4">Nenhum follow-up agendado</p>
                ) : (
                  <ActivityTimeline activities={followups} onFollowupToggle={handleFollowupToggle} />
                )}
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-4">
                <AddNoteForm onAdd={handleAddNote} />
                {notes.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-4">Nenhuma nota adicionada</p>
                ) : (
                  <ActivityTimeline activities={notes} onFollowupToggle={handleFollowupToggle} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showSendMessage && (
        <SendMessageModal
          contact={current}
          onClose={() => setShowSendMessage(false)}
          onSent={async () => {
            setShowSendMessage(false);
            await loadActivities();
          }}
        />
      )}
    </>
  );
}
