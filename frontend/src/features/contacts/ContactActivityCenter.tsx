import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { contactsAPI, type Contact, type ContactActivity, type ContactStatus } from './contacts.api';

export const STATUS_CONFIG: Record<ContactStatus, { label: string; color: string; bg: string; dot: string }> = {
  new: { label: 'Novo', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  contacted: { label: 'Contato iniciado', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  no_reply: { label: 'Sem resposta', color: 'text-gray-700', bg: 'bg-gray-100 border-gray-300', dot: 'bg-gray-500' },
  interested: { label: 'Interessado', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200', dot: 'bg-cyan-500' },
  negotiating: { label: 'Em negociacao', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200', dot: 'bg-violet-500' },
  client: { label: 'Fechado', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  lost: { label: 'Perdido', color: 'text-red-700', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
};

export const STATUS_OPTIONS: ContactStatus[] = [
  'new', 'contacted', 'no_reply', 'interested', 'negotiating', 'client', 'lost',
];

type ActivityVisual = {
  icon: ReactNode;
  border: string;
  text: string;
};

const ACTIVITY_VISUAL: Record<string, ActivityVisual> = {
  MESSAGE_SENT: {
    border: 'border-emerald-300 bg-emerald-50',
    text: 'text-emerald-700',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l8 2-8-18-8 18 8-2z" />
      </svg>
    ),
  },
  FOLLOWUP_CREATED: {
    border: 'border-amber-300 bg-amber-50',
    text: 'text-amber-700',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  NOTE_CREATED: {
    border: 'border-sky-300 bg-sky-50',
    text: 'text-sky-700',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.586 3.586a2 2 0 112.828 2.828L11 15H8v-3l9.586-8.414z" />
      </svg>
    ),
  },
  STATUS_CHANGED: {
    border: 'border-violet-300 bg-violet-50',
    text: 'text-violet-700',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
  },
  CAMPAIGN_SENT: {
    border: 'border-indigo-300 bg-indigo-50',
    text: 'text-indigo-700',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.88V19.2a1.8 1.8 0 01-3.4.6L5.4 13.7" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 13a3 3 0 100-6" />
      </svg>
    ),
  },
  CONTACT_CREATED: {
    border: 'border-teal-300 bg-teal-50',
    text: 'text-teal-700',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  MANUAL_INTERACTION: {
    border: 'border-slate-300 bg-slate-50',
    text: 'text-slate-700',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12c0 4.4-4 8-9 8a9.8 9.8 0 01-4.2-.9L3 20l1.4-3.7A8.7 8.7 0 013 12c0-4.4 4-8 9-8s9 3.6 9 8z" />
      </svg>
    ),
  },
};

function getActivityVisual(type: string): ActivityVisual {
  return ACTIVITY_VISUAL[type] ?? ACTIVITY_VISUAL.MANUAL_INTERACTION;
}

function toDigits(phone?: string): string {
  return (phone || '').replace(/\D/g, '');
}

function buildWhatsAppLink(phone?: string): string {
  const digits = toDigits(phone);
  return `https://wa.me/${digits}`;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`; 
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFollowupDue(iso: string): string {
  const due = new Date(iso);
  const now = new Date();
  const dayDiff = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  if (dayDiff < 0) return `Atrasado ${Math.abs(dayDiff)}d`;
  if (dayDiff === 0) return 'Hoje';
  if (dayDiff === 1) return 'Amanha';
  return due.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function getLeadOrigin(contact: Contact): string {
  if (contact.channel === 'whatsapp') return 'Outbound WhatsApp';
  if (contact.channel === 'email') return 'Campanha de e-mail';
  return 'Cadastro manual';
}

function getDisplayName(contact: Contact): string {
  return contact.name || contact.email || contact.phone || 'Contato';
}

function getInitial(contact: Contact): string {
  return getDisplayName(contact).charAt(0).toUpperCase() || '?';
}

function ActivityTimeline({ activities, onToggleFollowup }: {
  activities: ContactActivity[];
  onToggleFollowup: (activityId: string, done: boolean) => Promise<void>;
}) {
  if (activities.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="text-sm font-semibold text-text-primary">Sem atividades ainda</p>
        <p className="text-xs text-text-muted mt-1">A timeline comercial aparecera aqui.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <ol className="space-y-4">
        {activities.map((activity, index) => {
          const visual = getActivityVisual(activity.type);
          const scheduledFor = typeof activity.metadata?.scheduledFor === 'string' ? activity.metadata.scheduledFor : undefined;
          const isFollowup = activity.type === 'FOLLOWUP_CREATED';
          const done = Boolean(activity.metadata?.done);
          const isOverdue = isFollowup && !done && scheduledFor ? new Date(scheduledFor) < new Date() : false;
          const statusFrom = typeof activity.metadata?.from === 'string' ? activity.metadata.from : undefined;
          const statusTo = typeof activity.metadata?.to === 'string' ? activity.metadata.to : undefined;

          return (
            <li key={activity.id} className="relative pl-11">
              {index < activities.length - 1 && (
                <span className="absolute left-4 top-9 h-[calc(100%+12px)] w-px bg-border-light" />
              )}

              <div className={`absolute left-0 top-0 w-8 h-8 rounded-xl border ${visual.border} ${visual.text} flex items-center justify-center`}>
                {visual.icon}
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                    {activity.title}
                  </p>
                  {activity.description && (
                    <p className="text-xs text-text-secondary mt-1 whitespace-pre-wrap">{activity.description}</p>
                  )}
                  {activity.type === 'STATUS_CHANGED' && statusFrom && statusTo && (
                    <p className="text-xs text-text-muted mt-1">
                      {STATUS_CONFIG[statusFrom as ContactStatus]?.label ?? statusFrom}
                      {' -> '}
                      {STATUS_CONFIG[statusTo as ContactStatus]?.label ?? statusTo}
                    </p>
                  )}
                  {scheduledFor && (
                    <p className={`text-xs mt-1 ${isOverdue ? 'text-red-500' : 'text-amber-600'}`}>
                      {formatFollowupDue(scheduledFor)} - {formatTimestamp(scheduledFor)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-text-muted">{formatRelativeDate(activity.createdAt)}</span>
                  {isFollowup && (
                    <button
                      onClick={() => void onToggleFollowup(activity.id, !done)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                        done
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-border text-transparent hover:text-emerald-500 hover:border-emerald-500'
                      }`}
                      title={done ? 'Marcar pendente' : 'Marcar concluido'}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AddNotePanel({ onAdd }: { onAdd: (content: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onAdd(trimmed);
      setNote('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-text-primary">Notas internas</p>
        <p className="text-xs text-text-muted">Observacoes comerciais e historico manual.</p>
      </div>
      <textarea
        rows={4}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Ex.: Cliente mencionou prioridade em automacao do atendimento"
        className="w-full px-3 py-2 rounded-xl border border-border bg-surface-secondary text-sm text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-brand-400/40"
      />
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-text-muted">{note.length}/2000</span>
        <button
          onClick={() => void submit()}
          disabled={!note.trim() || saving}
          className="text-xs px-3 py-1.5 rounded-lg border border-brand-400/40 bg-brand-500/15 text-brand-300 hover:bg-brand-500/25 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Adicionar nota'}
        </button>
      </div>
    </div>
  );
}

function FollowupPanel({
  pending,
  overdueCount,
  onSchedule,
}: {
  pending: ContactActivity[];
  overdueCount: number;
  onSchedule: (scheduledFor: string, note: string, priority: 'low' | 'normal' | 'high') => Promise<void>;
}) {
  const [openForm, setOpenForm] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const nextFollowup = pending
    .filter((item) => typeof item.metadata?.scheduledFor === 'string')
    .sort((a, b) => new Date(String(a.metadata.scheduledFor)).getTime() - new Date(String(b.metadata.scheduledFor)).getTime())[0];

  const submit = async () => {
    if (!date) return;
    setSaving(true);
    try {
      await onSchedule(`${date}T${time}:00`, note, priority);
      setDate('');
      setTime('09:00');
      setPriority('normal');
      setNote('');
      setOpenForm(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">Area de follow-up</p>
          <p className="text-xs text-text-muted">Proximos passos, atrasos e lembretes.</p>
        </div>
        {overdueCount > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-red-300 bg-red-50 text-red-700 font-semibold">
            {overdueCount} atrasado{overdueCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-surface-secondary p-3">
          <p className="text-[10px] uppercase tracking-wide text-text-muted">Pendentes</p>
          <p className="text-lg font-bold text-text-primary">{pending.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-secondary p-3">
          <p className="text-[10px] uppercase tracking-wide text-text-muted">Proximo</p>
          <p className="text-xs font-semibold text-text-primary mt-1">
            {nextFollowup && typeof nextFollowup.metadata?.scheduledFor === 'string'
              ? `${formatFollowupDue(String(nextFollowup.metadata.scheduledFor))}`
              : 'Nao agendado'}
          </p>
        </div>
      </div>

      {!openForm && (
        <button
          onClick={() => setOpenForm(true)}
          className="w-full text-xs px-3 py-2 rounded-xl border border-dashed border-amber-400/50 text-amber-700 hover:bg-amber-50"
        >
          + Agendar follow-up
        </button>
      )}

      {openForm && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-xs text-text-primary"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-xs text-text-primary"
            />
          </div>

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'low' | 'normal' | 'high')}
            className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-xs text-text-primary"
          >
            <option value="low">Prioridade baixa</option>
            <option value="normal">Prioridade normal</option>
            <option value="high">Prioridade alta</option>
          </select>

          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Lembrete opcional"
            className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-xs text-text-primary resize-none"
          />

          <div className="flex gap-2">
            <button
              onClick={() => setOpenForm(false)}
              className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-amber-200 text-amber-800 bg-white"
            >
              Cancelar
            </button>
            <button
              onClick={() => void submit()}
              disabled={!date || saving}
              className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-100 text-amber-900 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar follow-up'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OutboundComposerModal({ contact, onClose, onSent }: {
  contact: Contact;
  onClose: () => void;
  onSent: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'ai' | 'manual'>('manual');
  const [manualMessage, setManualMessage] = useState('');
  const [promptBase, setPromptBase] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await contactsAPI.sendOutboundMessage(contact.id, {
        messageMode: mode,
        promptBase: mode === 'ai' ? promptBase.trim() : undefined,
        manualMessage: mode === 'manual' ? manualMessage.trim() : undefined,
      });
      await onSent();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar mensagem outbound.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-950/40" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl border border-border bg-surface shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary">Envio outbound</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-surface-secondary hover:bg-surface-elevated flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-secondary p-1">
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 text-xs py-1.5 rounded-lg font-semibold ${mode === 'manual' ? 'bg-surface border border-border text-text-primary' : 'text-text-secondary'}`}
          >
            Mensagem fixa
          </button>
          <button
            onClick={() => setMode('ai')}
            className={`flex-1 text-xs py-1.5 rounded-lg font-semibold ${mode === 'ai' ? 'bg-surface border border-border text-text-primary' : 'text-text-secondary'}`}
          >
            Gerar com IA
          </button>
        </div>

        {mode === 'manual' ? (
          <textarea
            rows={6}
            value={manualMessage}
            onChange={(e) => setManualMessage(e.target.value)}
            placeholder="Digite a mensagem para envio"
            className="w-full px-3 py-2 rounded-xl border border-border bg-surface-secondary text-sm text-text-primary resize-none"
          />
        ) : (
          <textarea
            rows={6}
            value={promptBase}
            onChange={(e) => setPromptBase(e.target.value)}
            placeholder="Descreva o prompt para gerar a mensagem"
            className="w-full px-3 py-2 rounded-xl border border-border bg-surface-secondary text-sm text-text-primary resize-none"
          />
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 text-xs px-3 py-2 rounded-lg border border-border bg-surface-secondary text-text-secondary">
            Cancelar
          </button>
          <button
            onClick={() => void send()}
            disabled={sending || (mode === 'manual' ? !manualMessage.trim() : !promptBase.trim())}
            className="flex-1 text-xs px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-100 text-emerald-800 disabled:opacity-50"
          >
            {sending ? 'Enviando...' : 'Enviar mensagem'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ContactActivityCenterProps {
  contact: Contact;
  onClose: () => void;
  onUpdated: (contact: Contact) => void;
  onDeleted: (id: string) => void;
}

export function ContactActivityCenter({ contact, onClose, onUpdated, onDeleted }: ContactActivityCenterProps) {
  const [current, setCurrent] = useState<Contact>(contact);
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  useEffect(() => {
    setCurrent(contact);
  }, [contact]);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await contactsAPI.getActivities(current.id);
      setActivities(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [current.id]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const updateContact = async (payload: Partial<Pick<Contact, 'name' | 'phone' | 'company' | 'status' | 'notes'>>) => {
    const { data } = await contactsAPI.update(current.id, payload);
    setCurrent(data);
    onUpdated(data);
  };

  const handleStatusChange = async (nextStatus: ContactStatus) => {
    setSavingStatus(true);
    try {
      await updateContact({ status: nextStatus });
      await loadActivities();
    } finally {
      setSavingStatus(false);
    }
  };

  const handleAddNote = async (content: string) => {
    await contactsAPI.addNote(current.id, content);
    await loadActivities();
  };

  const handleScheduleFollowup = async (scheduledFor: string, note: string, priority: 'low' | 'normal' | 'high') => {
    await contactsAPI.createFollowup(current.id, { scheduledFor, note, priority });
    await loadActivities();
  };

  const handleToggleFollowup = async (activityId: string, done: boolean) => {
    await contactsAPI.completeFollowup(current.id, activityId, done);
    await loadActivities();
  };

  const handleDelete = async () => {
    if (!confirm('Excluir contato?')) return;
    await contactsAPI.delete(current.id);
    onDeleted(current.id);
    onClose();
  };

  const followups = useMemo(
    () => activities.filter((item) => item.type === 'FOLLOWUP_CREATED'),
    [activities],
  );

  const pendingFollowups = useMemo(
    () => followups.filter((item) => !Boolean(item.metadata?.done)),
    [followups],
  );

  const overdueCount = useMemo(
    () => pendingFollowups.filter((item) => {
      const scheduledFor = item.metadata?.scheduledFor;
      return typeof scheduledFor === 'string' && new Date(scheduledFor) < new Date();
    }).length,
    [pendingFollowups],
  );

  const statusCfg = STATUS_CONFIG[current.status] ?? STATUS_CONFIG.new;
  const tags = [statusCfg.label, current.channel === 'whatsapp' ? 'WhatsApp' : current.channel === 'email' ? 'E-mail' : 'Manual'];

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end">
        <div className="absolute inset-0 bg-brand-950/35 backdrop-blur-sm" onClick={onClose} />

        <aside className="relative h-full w-full max-w-2xl border-l border-border bg-surface shadow-2xl overflow-y-auto">
          <div className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="w-8 h-8 rounded-xl bg-surface-secondary hover:bg-surface-elevated flex items-center justify-center">
                <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <p className="text-sm font-bold text-text-primary">Contact Activity Center</p>
                <p className="text-[11px] text-text-muted">Outbound, follow-up e organizacao comercial</p>
              </div>
            </div>
            {overdueCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-red-300 bg-red-50 text-red-700 font-semibold">
                {overdueCount} atrasado{overdueCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="p-5 space-y-4">
            <section className="rounded-2xl border border-border bg-surface p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 text-white font-bold flex items-center justify-center">
                  {getInitial(current)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-text-primary truncate">{getDisplayName(current)}</p>
                  <p className="text-xs text-text-secondary truncate">{current.company || 'Sem empresa informada'}</p>
                  <p className="text-xs text-text-muted mt-1">{current.phone ? `+${toDigits(current.phone)}` : 'Sem telefone'}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-surface-secondary text-text-secondary font-semibold">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-border bg-surface-secondary p-2.5">
                  <p className="text-text-muted">Origem</p>
                  <p className="text-text-primary font-semibold mt-0.5">{getLeadOrigin(current)}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-secondary p-2.5">
                  <p className="text-text-muted">Ultima interacao</p>
                  <p className="text-text-primary font-semibold mt-0.5">{current.lastMessageAt ? formatRelativeDate(current.lastMessageAt) : 'Sem historico'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => setShowComposer(true)}
                  className="text-xs px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-100 text-emerald-800 font-semibold"
                >
                  Enviar mensagem
                </button>

                {current.phone && (
                  <a
                    href={buildWhatsAppLink(current.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-2 rounded-xl border border-green-300 bg-green-100 text-green-800 font-semibold text-center"
                  >
                    Abrir WhatsApp
                  </a>
                )}

                <button
                  onClick={() => navigator.clipboard.writeText(current.phone || '').catch(() => {})}
                  className="text-xs px-3 py-2 rounded-xl border border-border bg-surface-secondary text-text-secondary font-semibold"
                >
                  Copiar telefone
                </button>

                <button
                  onClick={handleDelete}
                  className="text-xs px-3 py-2 rounded-xl border border-red-300 bg-red-50 text-red-700 font-semibold"
                >
                  Excluir contato
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-text-secondary">Mover status:</label>
                <select
                  value={current.status}
                  onChange={(e) => void handleStatusChange(e.target.value as ContactStatus)}
                  disabled={savingStatus}
                  className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-surface-secondary text-text-primary"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{STATUS_CONFIG[status].label}</option>
                  ))}
                </select>
              </div>
            </section>

            <FollowupPanel
              pending={pendingFollowups}
              overdueCount={overdueCount}
              onSchedule={handleScheduleFollowup}
            />

            <AddNotePanel onAdd={handleAddNote} />

            <section>
              <div className="mb-2">
                <p className="text-sm font-semibold text-text-primary">Timeline de atividades</p>
                <p className="text-xs text-text-muted">Historico completo de interacoes e acoes comerciais.</p>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-border bg-surface p-8 text-center">
                  <div className="h-6 w-6 rounded-full border-2 border-border border-t-brand-400 animate-spin mx-auto" />
                </div>
              ) : (
                <ActivityTimeline activities={activities} onToggleFollowup={handleToggleFollowup} />
              )}
            </section>
          </div>
        </aside>
      </div>

      {showComposer && (
        <OutboundComposerModal
          contact={current}
          onClose={() => setShowComposer(false)}
          onSent={loadActivities}
        />
      )}
    </>
  );
}
