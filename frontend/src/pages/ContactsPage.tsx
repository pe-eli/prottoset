import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SubscriptionLockedView } from '../components/subscription/SubscriptionLockedView';
import { useSubscription } from '../contexts/SubscriptionContext';
import {
  contactsAPI,
  type Contact,
  type ContactChannel,
  type ContactMessage,
  type ContactStatus,
} from '../features/contacts/contacts.api';

const STATUS_CONFIG: Record<ContactStatus, { label: string; color: string; bg: string }> = {
  new: { label: 'Novo', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  contacted: { label: 'Contatado', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  negotiating: { label: 'Negociando', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  client: { label: 'Cliente', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  lost: { label: 'Perdido', color: 'text-gray-500', bg: 'bg-gray-100 border-gray-200' },
};

const STATUS_OPTIONS: ContactStatus[] = ['new', 'contacted', 'negotiating', 'client', 'lost'];

interface SavedPrompt {
  id: string;
  name: string;
  content: string;
}

interface ContactGroup {
  key: string;
  contacts: Contact[];
  primary: Contact;
  messages: ContactMessage[];
  unreadCount: number;
}

function EmailIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function WaIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function PersonIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status as ContactStatus] ?? STATUS_CONFIG.new;
}

function getChannel(c: Contact): ContactChannel {
  return c.channel ?? 'manual';
}

function normalizePhone(value: string): string {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function getGroupKey(contact: Contact): string {
  if (getChannel(contact) === 'whatsapp' && contact.phone) {
    return `wa:${normalizePhone(contact.phone)}`;
  }
  return `contact:${contact.id}`;
}

export function ContactsPage() {
  const { subscription } = useSubscription();
  const hasActiveSubscription = subscription?.status === 'active';

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ContactStatus | 'all'>('all');
  const [channelTab, setChannelTab] = useState<ContactChannel | 'all'>('all');
  const [messagesByContact, setMessagesByContact] = useState<Record<string, ContactMessage[]>>({});

  const [replyGroup, setReplyGroup] = useState<ContactGroup | null>(null);
  const [detailGroup, setDetailGroup] = useState<ContactGroup | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await contactsAPI.getAll();
      setContacts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const markGroupAsRead = useCallback(async (group: ContactGroup, optimistic = false) => {
    const ids = [...new Set(group.contacts.map((contact) => contact.id))];
    if (optimistic) {
      const readAt = new Date().toISOString();
      setContacts((prev) => prev.map((contact) => (
        ids.includes(contact.id)
          ? { ...contact, lastReadAt: readAt }
          : contact
      )));
    }
    await Promise.allSettled(ids.map((id) => contactsAPI.markRead(id)));
  }, []);

  const closeDetailModal = useCallback(() => {
    if (!detailGroup) {
      setDetailGroup(null);
      return;
    }

    const target = detailGroup;
    setDetailGroup(null);
    if (target.unreadCount > 0) {
      void markGroupAsRead(target, true);
    }
  }, [detailGroup, markGroupAsRead]);

  const fetchMessages = useCallback(async (list: Contact[]) => {
    const candidates = list.filter((c) => getChannel(c) === 'whatsapp');
    if (candidates.length === 0) {
      return;
    }

    const results = await Promise.allSettled(
      candidates.map(async (contact) => {
        const { data } = await contactsAPI.getMessages(contact.id);
        return { contactId: contact.id, messages: Array.isArray(data) ? data : [] };
      }),
    );

    const next: Record<string, ContactMessage[]> = {};
    for (const result of results) {
      if (result.status === 'fulfilled') {
        next[result.value.contactId] = result.value.messages;
      }
    }

    setMessagesByContact((prev) => ({ ...prev, ...next }));
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    fetchMessages(contacts);
  }, [contacts, fetchMessages]);

  useEffect(() => {
    const id = window.setInterval(() => {
      fetchMessages(contacts);
    }, 7000);
    return () => window.clearInterval(id);
  }, [contacts, fetchMessages]);

  const handleStatusChange = useCallback(async (id: string, status: ContactStatus) => {
    try {
      await contactsAPI.update(id, { status });
      await fetchContacts();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }, [fetchContacts]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await contactsAPI.delete(id);
      await fetchContacts();
    } catch (err) {
      console.error('Failed to delete contact:', err);
    }
  }, [fetchContacts]);

  const channelFiltered = useMemo(() => (
    channelTab === 'all'
      ? contacts
      : contacts.filter((c) => getChannel(c) === channelTab)
  ), [contacts, channelTab]);

  const filtered = useMemo(() => (
    filter === 'all' ? channelFiltered : channelFiltered.filter((c) => c.status === filter)
  ), [channelFiltered, filter]);

  const grouped = useMemo<ContactGroup[]>(() => {
    const map = new Map<string, Contact[]>();
    for (const contact of filtered) {
      const key = getGroupKey(contact);
      const current = map.get(key) ?? [];
      current.push(contact);
      map.set(key, current);
    }

    const groups: ContactGroup[] = [];
    for (const [key, list] of map.entries()) {
      const sortedContacts = [...list].sort((a, b) => {
        const aDate = new Date(a.updatedAt).getTime();
        const bDate = new Date(b.updatedAt).getTime();
        return bDate - aDate;
      });
      const primary = sortedContacts[0];
      const mergedMessages = sortedContacts
        .flatMap((c) => messagesByContact[c.id] ?? [])
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

      const lastReadAt = sortedContacts
        .map((c) => c.lastReadAt)
        .filter((date): date is string => Boolean(date))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
      const readTimestamp = lastReadAt ? new Date(lastReadAt).getTime() : 0;
      const unreadCount = mergedMessages.filter((msg) => (
        msg.direction === 'inbound' && new Date(msg.sentAt).getTime() > readTimestamp
      )).length;

      groups.push({
        key,
        contacts: sortedContacts,
        primary,
        messages: mergedMessages,
        unreadCount,
      });
    }

    groups.sort((a, b) => {
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
      const aDate = a.primary.lastMessageAt || a.primary.updatedAt;
      const bDate = b.primary.lastMessageAt || b.primary.updatedAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    return groups;
  }, [filtered, messagesByContact]);

  const emailCount = contacts.filter((c) => getChannel(c) === 'email').length;
  const waCount = contacts.filter((c) => getChannel(c) === 'whatsapp').length;
  const manualCount = contacts.length - emailCount - waCount;

  const channelTabs: Array<{ key: ContactChannel | 'all'; label: string; count: number }> = [
    { key: 'all', label: 'Todos', count: contacts.length },
    { key: 'email', label: 'Email', count: emailCount },
    { key: 'whatsapp', label: 'WhatsApp', count: waCount },
    { key: 'manual', label: 'Manual', count: manualCount },
  ];

  if (!hasActiveSubscription) {
    return (
      <SubscriptionLockedView
        featureName="Contatos e CRM"
        description="O funil de contatos fica disponível com uma assinatura ativa. Assine para desbloquear gestão de contatos, e-mail e WhatsApp."
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/leads" className="w-9 h-9 rounded-xl bg-surface-secondary hover:bg-surface-elevated flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Contatos</h2>
            <p className="text-sm text-text-secondary">Conversas por WhatsApp agrupadas por número</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/leads/disparos">
            <Button variant="outline" size="sm">
              <EmailIcon className="w-3.5 h-3.5" />
              Novo Disparo E-mail
            </Button>
          </Link>
          <Link to="/leads/whatsapp">
            <Button variant="outline" size="sm">
              <WaIcon className="w-3.5 h-3.5" />
              Novo Disparo WhatsApp
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={contacts.length} gradient="from-brand-600 to-brand-400" />
        <StatCard label="Via Email" value={emailCount} gradient="from-blue-500 to-cyan-400" />
        <StatCard label="Via WhatsApp" value={waCount} gradient="from-emerald-500 to-teal-400" />
        <StatCard label="Clientes" value={contacts.filter((c) => c.status === 'client').length} gradient="from-amber-500 to-yellow-400" />
      </div>

      <div className="flex items-center gap-1 bg-surface-secondary border border-border rounded-xl p-1 w-fit">
        {channelTabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setChannelTab(key)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-200 font-semibold ${
              channelTab === key ? 'bg-surface text-text-primary shadow-sm border border-border' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {key === 'email' && <EmailIcon />}
            {key === 'whatsapp' && <WaIcon />}
            {key === 'manual' && <PersonIcon />}
            {label}
            {count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center ${
                channelTab === key ? 'bg-brand-400/15 text-brand-200' : 'bg-brand-400/10 text-brand-300'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 bg-surface-secondary border border-border rounded-xl p-1 w-fit">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="Todos" />
        {STATUS_OPTIONS.map((s) => (
          <FilterButton key={s} active={filter === s} onClick={() => setFilter(s)} label={STATUS_CONFIG[s].label} />
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-brand-300">Carregando contatos...</div>
      ) : grouped.length === 0 ? (
        <Card className="text-center py-12" gradient>
          <p className="text-sm text-brand-400">Nenhum contato encontrado</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => {
            const ch = getChannel(group.primary);
            const displayName = group.primary.name || group.primary.email || group.primary.phone || '?';
            const phone = group.primary.phone || '';
            const bubbleMessages = group.messages.length > 0
              ? group.messages
              : (group.primary.lastMessage ? [{
                id: `${group.primary.id}-last`,
                contactId: group.primary.id,
                channel: ch,
                direction: 'outbound' as const,
                content: group.primary.lastMessage,
                sentAt: group.primary.lastMessageAt || group.primary.updatedAt,
                createdAt: group.primary.updatedAt,
              }] : []);

            return (
              <Card key={group.key} hover className="!p-0">
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 text-left min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shrink-0 shadow-sm">
                        <span className="text-white font-bold text-sm">{displayName.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-text-primary truncate">{displayName}</h4>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                            ch === 'whatsapp'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : ch === 'email'
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : 'bg-brand-50 border-brand-200 text-brand-500'
                          }`}>
                            {ch === 'whatsapp' ? <WaIcon /> : ch === 'email' ? <EmailIcon /> : <PersonIcon />}
                            {ch === 'whatsapp' ? 'WhatsApp' : ch === 'email' ? 'Email' : 'Manual'}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${getStatusConfig(group.primary.status).bg} ${getStatusConfig(group.primary.status).color}`}>
                            {getStatusConfig(group.primary.status).label}
                          </span>
                          {phone && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                              {phone}
                            </span>
                          )}
                          {group.unreadCount > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border border-brand-400/40 bg-brand-500/20 text-brand-100">
                              {group.unreadCount} nova{group.unreadCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0" onClick={(event) => event.stopPropagation()}>
                      <select
                        value={group.primary.status}
                        onChange={(event) => handleStatusChange(group.primary.id, event.target.value as ContactStatus)}
                        className="text-[11px] px-2 py-1.5 bg-surface-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-400/40 cursor-pointer"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        onClick={() => setReplyGroup(group)}
                        disabled={getChannel(group.primary) !== 'whatsapp' || !group.primary.phone}
                      >
                        Responder
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setDetailGroup(group)}
                      >
                        Detalhes
                      </Button>
                    </div>
                  </div>

                  {bubbleMessages.length > 0 && (
                    <div className="rounded-xl border border-border-light bg-surface-secondary/70 p-3 max-h-44 overflow-y-auto space-y-2">
                      {bubbleMessages.map((msg) => {
                        const mine = msg.direction === 'outbound';
                        return (
                          <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                              mine
                                ? 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-100'
                                : 'bg-surface border border-border text-text-primary'
                            }`}>
                              <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                              <p className="text-[10px] mt-1 opacity-70">{formatDateTime(msg.sentAt)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {replyGroup && (
        <ReplyModal
          group={replyGroup}
          onClose={() => setReplyGroup(null)}
          onSent={async () => {
            await fetchContacts();
            await fetchMessages(contacts);
            setReplyGroup(null);
          }}
        />
      )}

      {detailGroup && (
        <DetailModal
          group={detailGroup}
          onClose={closeDetailModal}
          onDeleted={async (id) => {
            await handleDelete(id);
            setDetailGroup(null);
          }}
          onSaved={async () => {
            await fetchContacts();
            await fetchMessages(contacts);
          }}
          onReply={() => setReplyGroup(detailGroup)}
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

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-200 font-semibold ${
        active ? 'bg-surface text-text-primary shadow-sm border border-border' : 'text-text-secondary hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  );
}

function ReplyModal({
  group,
  onClose,
  onSent,
}: {
  group: ContactGroup;
  onClose: () => void;
  onSent: () => Promise<void>;
}) {
  const [messageMode, setMessageMode] = useState<'ai' | 'manual'>('ai');
  const [manualMessage, setManualMessage] = useState('');
  const [promptBase, setPromptBase] = useState('Crie uma resposta curta, cordial e objetiva para continuar a conversa no WhatsApp.');
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem('closr.whatsapp.savedPrompts');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const normalized = parsed
        .filter((entry): entry is SavedPrompt => {
          if (!entry || typeof entry !== 'object') return false;
          const candidate = entry as Record<string, unknown>;
          return typeof candidate.id === 'string'
            && typeof candidate.name === 'string'
            && typeof candidate.content === 'string';
        })
        .slice(0, 50);
      setSavedPrompts(normalized);
    } catch {
      setSavedPrompts([]);
    }
  }, []);

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      await contactsAPI.replyWhatsapp(group.primary.id, {
        messageMode,
        promptBase: messageMode === 'ai' ? promptBase : undefined,
        manualMessage: messageMode === 'manual' ? manualMessage : undefined,
      });
      await onSent();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao enviar resposta';
      setError(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-950/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl border border-border-light shadow-2xl w-full max-w-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-text-primary">Responder cliente</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-surface-secondary hover:bg-surface-elevated flex items-center justify-center">
            <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-1 bg-surface-secondary border border-border rounded-xl p-1 w-fit">
          <button
            type="button"
            onClick={() => setMessageMode('ai')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${messageMode === 'ai' ? 'bg-surface text-text-primary border border-border' : 'text-text-secondary'}`}
          >
            Prompt (IA)
          </button>
          <button
            type="button"
            onClick={() => setMessageMode('manual')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${messageMode === 'manual' ? 'bg-surface text-text-primary border border-border' : 'text-text-secondary'}`}
          >
            Mensagem fixa
          </button>
        </div>

        {messageMode === 'ai' ? (
          <div className="space-y-2">
            {savedPrompts.length > 0 && (
              <select
                value={selectedPromptId}
                onChange={(event) => {
                  const id = event.target.value;
                  setSelectedPromptId(id);
                  const selected = savedPrompts.find((prompt) => prompt.id === id);
                  if (selected) setPromptBase(selected.content);
                }}
                className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary"
              >
                <option value="">Selecionar prompt salvo</option>
                {savedPrompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>{prompt.name}</option>
                ))}
              </select>
            )}
            <textarea
              rows={5}
              value={promptBase}
              onChange={(event) => setPromptBase(event.target.value)}
              placeholder="Digite o prompt para gerar a resposta"
              className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary resize-none"
            />
          </div>
        ) : (
          <textarea
            rows={5}
            value={manualMessage}
            onChange={(event) => setManualMessage(event.target.value)}
            placeholder="Digite a mensagem fixa"
            className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary resize-none"
          />
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSend}
            disabled={sending || (messageMode === 'manual' ? !manualMessage.trim() : !promptBase.trim())}
          >
            {sending ? 'Enviando...' : 'Enviar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({
  group,
  onClose,
  onDeleted,
  onSaved,
  onReply,
}: {
  group: ContactGroup;
  onClose: () => void;
  onDeleted: (id: string) => Promise<void>;
  onSaved: () => Promise<void>;
  onReply: () => void;
}) {
  const [form, setForm] = useState({
    name: group.primary.name,
    phone: group.primary.phone,
    company: group.primary.company,
    notes: group.primary.notes,
    status: group.primary.status,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await contactsAPI.update(group.primary.id, {
        name: form.name,
        phone: form.phone,
        company: form.company,
        notes: form.notes,
        status: form.status,
      });
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  const messages = group.messages.length > 0
    ? group.messages
    : (group.primary.lastMessage ? [{
      id: `${group.primary.id}-last`,
      contactId: group.primary.id,
      channel: getChannel(group.primary),
      direction: 'outbound' as const,
      content: group.primary.lastMessage,
      sentAt: group.primary.lastMessageAt || group.primary.updatedAt,
      createdAt: group.primary.updatedAt,
    }] : []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-950/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl border border-border-light shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-text-primary">Detalhes do contato</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-surface-secondary hover:bg-surface-elevated flex items-center justify-center">
            <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Nome"
            className="px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary"
          />
          <input
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            placeholder="Telefone"
            className="px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary"
          />
          <input
            value={form.company}
            onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))}
            placeholder="Empresa"
            className="px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary"
          />
          <select
            value={form.status}
            onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as ContactStatus }))}
            className="px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{STATUS_CONFIG[status].label}</option>
            ))}
          </select>
        </div>

        <textarea
          rows={3}
          value={form.notes}
          onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          placeholder="Observações"
          className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary resize-none"
        />

        <div className="rounded-xl border border-border-light bg-surface-secondary/70 p-4 max-h-[46vh] overflow-y-auto space-y-2">
          {messages.length === 0 ? (
            <p className="text-xs text-text-muted">Sem mensagens ainda.</p>
          ) : messages.map((msg) => {
            const mine = msg.direction === 'outbound';
            return (
              <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-2xl px-3 py-2 ${
                  mine
                    ? 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-100'
                    : 'bg-surface border border-border text-text-primary'
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <p className="text-[10px] mt-1 opacity-70">{formatDateTime(msg.sentAt)}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button onClick={onReply} disabled={getChannel(group.primary) !== 'whatsapp' || !group.primary.phone}>Responder</Button>
          <Button variant="secondary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Editar / Salvar'}</Button>
          <Button variant="outline" onClick={() => onDeleted(group.primary.id)}>Excluir</Button>
        </div>
      </div>
    </div>
  );
}
