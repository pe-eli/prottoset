import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SubscriptionLockedView } from '../components/subscription/SubscriptionLockedView';
import { useSubscription } from '../contexts/useSubscription';
import type { AuthUser } from '../features/auth/auth.api';
import { contactsAPI, type Contact, type ContactStatus } from '../features/contacts/contacts.api';
import { ContactActivityCenter, STATUS_CONFIG, STATUS_OPTIONS } from '../features/contacts/ContactActivityCenter';

function getChannel(c: Contact) {
  return c.channel ?? 'manual';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `${diffMins}min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function WaIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function EmailIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function StatCard({ label, value, sub, gradient }: { label: string; value: number; sub?: string; gradient: string }) {
  return (
    <div className="bg-surface border border-border-light rounded-2xl shadow-sm p-4 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${gradient} opacity-5 rounded-bl-3xl`} />
      <p className="text-xs text-text-secondary font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>{value}</p>
      {sub && <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function PipelineBar({ contacts }: { contacts: Contact[] }) {
  const counts = useMemo(() => {
    const map: Record<ContactStatus, number> = {
      new: 0, contacted: 0, no_reply: 0, interested: 0, negotiating: 0, client: 0, lost: 0,
    };
    for (const c of contacts) {
      if (c.status in map) map[c.status as ContactStatus]++;
    }
    return map;
  }, [contacts]);

  const total = contacts.length || 1;

  return (
    <div className="bg-surface border border-border-light rounded-2xl p-4 space-y-3">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Pipeline de status</p>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
        {STATUS_OPTIONS.map((status) => {
          const pct = (counts[status] / total) * 100;
          if (pct === 0) return null;
          const cfg = STATUS_CONFIG[status];
          return (
            <div
              key={status}
              style={{ width: `${pct}%` }}
              className={`${cfg.dot} transition-all duration-500`}
              title={`${cfg.label}: ${counts[status]}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {STATUS_OPTIONS.filter((s) => counts[s] > 0).map((status) => {
          const cfg = STATUS_CONFIG[status];
          return (
            <div key={status} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className="text-[10px] text-text-muted">{cfg.label} ({counts[status]})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContactCard({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  const statusCfg = STATUS_CONFIG[contact.status] ?? STATUS_CONFIG.new;
  const ch = getChannel(contact);
  const displayName = contact.name || contact.email || contact.phone || 'Contato';
  const initials = displayName.charAt(0).toUpperCase();
  const lastAt = contact.lastMessageAt || contact.updatedAt;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 bg-surface border border-border-light rounded-2xl hover:border-brand-400/40 hover:shadow-md hover:shadow-brand-500/5 transition-all duration-200 group"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 flex items-center justify-center shrink-0 shadow-sm">
          <span className="text-white font-bold text-sm">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-text-primary truncate group-hover:text-brand-300 transition-colors">
              {displayName}
            </p>
            <span className="text-[10px] text-text-muted shrink-0">{formatDate(lastAt)}</span>
          </div>
          {(contact.company || contact.phone) && (
            <p className="text-xs text-text-secondary truncate mt-0.5">
              {contact.company || contact.phone}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold border ${statusCfg.bg} ${statusCfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
              {statusCfg.label}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
              ch === 'whatsapp'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : ch === 'email'
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-surface-secondary border-border text-text-muted'
            }`}>
              {ch === 'whatsapp' ? <WaIcon /> : ch === 'email' ? <EmailIcon /> : null}
              {ch === 'whatsapp' ? 'WhatsApp' : ch === 'email' ? 'Email' : 'Manual'}
            </span>
          </div>
          {contact.lastMessage && (
            <p className="text-[11px] text-text-muted mt-2 truncate leading-relaxed">
              {contact.lastMessage}
            </p>
          )}
        </div>
        <svg className="w-4 h-4 text-text-muted group-hover:text-brand-400 shrink-0 mt-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

export function ContactsPage() {
  useOutletContext<{ user: AuthUser }>();
  const { subscription } = useSubscription();
  const hasActiveSubscription = subscription?.status === 'active';

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'email' | 'manual'>('all');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

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

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const filtered = useMemo(() => {
    let list = contacts;
    if (statusFilter !== 'all') {
      list = list.filter((c) => c.status === statusFilter);
    }
    if (channelFilter !== 'all') {
      list = list.filter((c) => getChannel(c) === channelFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.company?.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const aDate = a.lastMessageAt || a.updatedAt;
      const bDate = b.lastMessageAt || b.updatedAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }, [contacts, statusFilter, channelFilter, search]);

  const handleContactUpdated = useCallback((updated: Contact) => {
    setContacts((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    setSelectedContact(updated);
  }, []);

  const handleContactDeleted = useCallback((id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setSelectedContact(null);
  }, []);

  const closedCount = contacts.filter((c) => c.status === 'client').length;
  const interestedCount = contacts.filter((c) => c.status === 'interested' || c.status === 'negotiating').length;
  const waCount = contacts.filter((c) => getChannel(c) === 'whatsapp').length;

  if (!hasActiveSubscription) {
    return (
      <SubscriptionLockedView
        featureName="Contatos e CRM"
        description="O CRM de prospecção fica disponível com uma assinatura ativa. Assine para desbloquear."
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/leads"
            className="w-9 h-9 rounded-xl bg-surface-secondary hover:bg-surface-elevated flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Contatos</h2>
            <p className="text-sm text-text-secondary">CRM de prospecção e acompanhamento</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/leads/disparos">
            <Button variant="outline" size="sm">
              <EmailIcon className="w-3.5 h-3.5" />
              Disparo Email
            </Button>
          </Link>
          <Link to="/leads/whatsapp">
            <Button variant="outline" size="sm">
              <WaIcon className="w-3.5 h-3.5" />
              Disparo WhatsApp
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={contacts.length} gradient="from-brand-600 to-brand-400" />
        <StatCard label="WhatsApp" value={waCount} gradient="from-emerald-500 to-teal-400" />
        <StatCard label="Interessados" value={interestedCount} gradient="from-amber-500 to-yellow-400" sub="Interessado + Em neg." />
        <StatCard label="Fechados" value={closedCount} gradient="from-purple-500 to-violet-400" />
      </div>

      {contacts.length > 0 && <PipelineBar contacts={contacts} />}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, email, telefone..."
            className="w-full pl-9 pr-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-400/40"
          />
        </div>
        <div className="flex items-center gap-1 bg-surface-secondary border border-border rounded-xl p-1">
          {([
            { key: 'all', label: 'Canal' },
            { key: 'whatsapp', label: 'WhatsApp' },
            { key: 'email', label: 'Email' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setChannelFilter(key)}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                channelFilter === key
                  ? 'bg-surface text-text-primary border border-border shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-wrap bg-surface-secondary border border-border rounded-xl p-1 w-fit">
        <button
          onClick={() => setStatusFilter('all')}
          className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
            statusFilter === 'all'
              ? 'bg-surface text-text-primary border border-border shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Todos
        </button>
        {STATUS_OPTIONS.map((s) => {
          const cfg = STATUS_CONFIG[s];
          const count = contacts.filter((c) => c.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                statusFilter === s
                  ? 'bg-surface text-text-primary border border-border shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
              {count > 0 && (
                <span className="text-[10px] px-1 rounded font-bold opacity-60">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="h-6 w-6 rounded-full border-2 border-border border-t-brand-400 animate-spin mx-auto" />
          <p className="text-sm text-text-muted mt-3">Carregando contatos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-12" gradient>
          <div className="w-12 h-12 rounded-2xl bg-surface-secondary flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          {search || statusFilter !== 'all' || channelFilter !== 'all' ? (
            <>
              <p className="text-sm font-semibold text-text-primary">Nenhum resultado</p>
              <p className="text-xs text-text-muted mt-1">Tente ajustar os filtros</p>
              <button
                onClick={() => { setSearch(''); setStatusFilter('all'); setChannelFilter('all'); }}
                className="mt-3 text-xs text-brand-400 hover:text-brand-300 font-semibold"
              >
                Limpar filtros
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-text-primary">Nenhum contato ainda</p>
              <p className="text-xs text-text-muted mt-1">
                Contatos aparecem aqui após disparos por WhatsApp ou Email
              </p>
            </>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-text-muted px-1">{filtered.length} contato{filtered.length !== 1 ? 's' : ''}</p>
          {filtered.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onClick={() => setSelectedContact(contact)}
            />
          ))}
        </div>
      )}

      {selectedContact && (
        <ContactActivityCenter
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onUpdated={handleContactUpdated}
          onDeleted={handleContactDeleted}
        />
      )}
    </div>
  );
}
