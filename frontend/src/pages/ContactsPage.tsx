import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { contactsAPI, type Contact, type ContactStatus, type ContactChannel } from '../features/contacts/contacts.api';

const STATUS_CONFIG: Record<ContactStatus, { label: string; color: string; bg: string }> = {
  new: { label: 'Novo', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  contacted: { label: 'Contatado', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  negotiating: { label: 'Negociando', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  client: { label: 'Cliente', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  lost: { label: 'Perdido', color: 'text-gray-500', bg: 'bg-gray-100 border-gray-200' },
};

const STATUS_OPTIONS: ContactStatus[] = ['new', 'contacted', 'negotiating', 'client', 'lost'];

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

const CHANNEL_CONFIG: Record<ContactChannel, {
  label: string;
  color: string;
  bg: string;
  avatarGrad: string;
  msgBg: string;
  msgBorder: string;
  msgText: string;
  icon: React.ReactNode;
}> = {
  email: {
    label: 'Email',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    avatarGrad: 'from-brand-600 to-brand-400',
    msgBg: 'bg-blue-50/60',
    msgBorder: 'border-blue-100',
    msgText: 'text-blue-500',
    icon: <EmailIcon />,
  },
  whatsapp: {
    label: 'WhatsApp',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
    avatarGrad: 'from-emerald-500 to-teal-400',
    msgBg: 'bg-emerald-50/60',
    msgBorder: 'border-emerald-100',
    msgText: 'text-emerald-600',
    icon: <WaIcon />,
  },
  manual: {
    label: 'Manual',
    color: 'text-brand-500',
    bg: 'bg-brand-50 border-brand-200',
    avatarGrad: 'from-brand-500 to-brand-400',
    msgBg: 'bg-brand-50/60',
    msgBorder: 'border-brand-100',
    msgText: 'text-brand-400',
    icon: <PersonIcon />,
  },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status as ContactStatus] ?? STATUS_CONFIG['new'];
}

function getChannel(c: Contact): ContactChannel {
  return c.channel ?? 'manual';
}

export function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', company: '', notes: '' });
  const [filter, setFilter] = useState<ContactStatus | 'all'>('all');
  const [channelTab, setChannelTab] = useState<ContactChannel | 'all'>('all');
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

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

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const toggleMessageExpand = (id: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setEditForm({ name: contact.name, phone: contact.phone, company: contact.company, notes: contact.notes });
  };

  const handleSave = async (id: string) => {
    try {
      const { data } = await contactsAPI.update(id, editForm);
      setContacts((prev) => prev.map((c) => (c.id === id ? data : c)));
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update contact:', err);
    }
  };

  const handleStatusChange = async (id: string, status: ContactStatus) => {
    try {
      const { data } = await contactsAPI.update(id, { status });
      setContacts((prev) => prev.map((c) => (c.id === id ? data : c)));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await contactsAPI.delete(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Failed to delete contact:', err);
    }
  };

  const channelFiltered = channelTab === 'all'
    ? contacts
    : contacts.filter((c) => getChannel(c) === channelTab);
  const filtered = filter === 'all' ? channelFiltered : channelFiltered.filter((c) => c.status === filter);

  const emailCount = contacts.filter((c) => getChannel(c) === 'email').length;
  const waCount = contacts.filter((c) => getChannel(c) === 'whatsapp').length;
  const manualCount = contacts.length - emailCount - waCount;

  const channelTabs: Array<{ key: ContactChannel | 'all'; label: string; count: number }> = [
    { key: 'all', label: 'Todos', count: contacts.length },
    { key: 'email', label: 'Email', count: emailCount },
    { key: 'whatsapp', label: 'WhatsApp', count: waCount },
    { key: 'manual', label: 'Manual', count: manualCount },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/leads" className="w-9 h-9 rounded-xl bg-brand-50 hover:bg-brand-100 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-brand-950">Contatos</h2>
            <p className="text-sm text-brand-400">Gerencie seus potenciais clientes</p>
          </div>
        </div>
        <Link to="/leads/disparos">
          <Button variant="outline" size="sm">
            <EmailIcon className="w-3.5 h-3.5" />
            Novo Disparo
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={contacts.length} gradient="from-brand-600 to-brand-400" />
        <StatCard label="Via Email" value={emailCount} gradient="from-blue-500 to-cyan-400" />
        <StatCard label="Via WhatsApp" value={waCount} gradient="from-emerald-500 to-teal-400" />
        <StatCard label="Clientes" value={contacts.filter((c) => c.status === 'client').length} gradient="from-amber-500 to-yellow-400" />
      </div>

      {/* Channel tabs */}
      <div className="flex items-center gap-1 bg-brand-50 rounded-xl p-1 w-fit">
        {channelTabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setChannelTab(key)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-200 font-semibold ${
              channelTab === key ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-400 hover:text-brand-600'
            }`}
          >
            {key === 'email' && <EmailIcon />}
            {key === 'whatsapp' && <WaIcon />}
            {key === 'manual' && <PersonIcon />}
            {label}
            {count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center ${
                channelTab === key ? 'bg-brand-100 text-brand-600' : 'bg-brand-100/60 text-brand-300'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Status filters */}
      <div className="flex items-center gap-1.5 bg-brand-50 rounded-xl p-1 w-fit">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="Todos" />
        {STATUS_OPTIONS.map((s) => (
          <FilterButton key={s} active={filter === s} onClick={() => setFilter(s)} label={STATUS_CONFIG[s].label} />
        ))}
      </div>

      {/* Contact list */}
      {loading ? (
        <div className="text-center py-12 text-sm text-brand-300">Carregando contatos...</div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-12" gradient>
          <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm text-brand-400">Nenhum contato encontrado</p>
          <p className="text-xs text-brand-300 mt-1">
            {channelTab === 'whatsapp' ? (
              <>Use o{' '}<Link to="/leads/whatsapp" className="text-brand-500 hover:underline">Disparo de WhatsApp</Link>{' '}para adicionar contatos</>
            ) : (
              <>Use o{' '}<Link to="/leads/disparos" className="text-brand-500 hover:underline">Disparo de E-mails</Link>{' '}para adicionar contatos</>
            )}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((contact) => {
            const ch = getChannel(contact);
            const chCfg = CHANNEL_CONFIG[ch];
            const displayName = contact.name || contact.email || contact.phone || '?';
            const isExpanded = expandedMessages.has(contact.id);

            return (
              <Card key={contact.id} hover className="!p-0">
                {editingId === contact.id ? (
                  /* ── Edit mode ── */
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-brand-950">{contact.email || contact.phone}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${getStatusConfig(contact.status).bg} ${getStatusConfig(contact.status).color}`}>
                        {getStatusConfig(contact.status).label}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Nome"
                        className="px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all"
                      />
                      <input
                        value={editForm.phone}
                        onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="Telefone"
                        className="px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all"
                      />
                      <input
                        value={editForm.company}
                        onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}
                        placeholder="Empresa"
                        className="px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all"
                      />
                    </div>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Observações..."
                      rows={2}
                      className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all resize-none"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSave(contact.id)}>Salvar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  /* ── View mode ── */
                  <div className="p-4 flex items-start gap-4">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${chCfg.avatarGrad} flex items-center justify-center shrink-0 shadow-sm`}>
                      <span className="text-white font-bold text-sm">{displayName.charAt(0).toUpperCase()}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {/* Name + badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-brand-950">{displayName}</h4>
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold border ${chCfg.bg} ${chCfg.color}`}>
                          {chCfg.icon}
                          {chCfg.label}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${getStatusConfig(contact.status).bg} ${getStatusConfig(contact.status).color}`}>
                          {getStatusConfig(contact.status).label}
                        </span>
                      </div>

                      {/* Secondary info */}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {contact.name && contact.email && (
                          <p className="text-xs text-brand-400">{contact.email}</p>
                        )}
                        {contact.phone && (contact.email || contact.name) && (
                          <span className="text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg font-medium">{contact.phone}</span>
                        )}
                        {contact.company && (
                          <span className="text-[11px] text-brand-500 bg-brand-50 px-2 py-0.5 rounded-lg font-medium">{contact.company}</span>
                        )}
                      </div>

                      {/* Last message block */}
                      {contact.lastMessage && (
                        <div className={`mt-2 rounded-xl border px-3 py-2.5 ${chCfg.msgBg} ${chCfg.msgBorder}`}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className={chCfg.msgText}>{chCfg.icon}</span>
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${chCfg.msgText}`}>
                              Mensagem enviada
                            </span>
                            {contact.lastMessageAt && (
                              <span className="text-[10px] text-brand-300 ml-auto shrink-0">
                                {formatDateTime(contact.lastMessageAt)}
                              </span>
                            )}
                          </div>
                          <p className={`text-xs text-brand-800 whitespace-pre-wrap leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
                            {contact.lastMessage}
                          </p>
                          {contact.lastMessage.length > 160 && (
                            <button
                              onClick={() => toggleMessageExpand(contact.id)}
                              className={`text-[10px] font-semibold mt-1.5 transition-colors ${chCfg.msgText} hover:opacity-70`}
                            >
                              {isExpanded ? '↑ Ver menos' : '↓ Ver mais'}
                            </button>
                          )}
                        </div>
                      )}

                      {contact.notes && (
                        <p className="text-xs text-brand-400 mt-2 bg-surface-secondary rounded-lg px-3 py-2 leading-relaxed">
                          {contact.notes}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={contact.status}
                        onChange={(e) => handleStatusChange(contact.id, e.target.value as ContactStatus)}
                        className="text-[11px] px-2 py-1.5 bg-surface-secondary border border-border rounded-lg text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400/40 cursor-pointer"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleEdit(contact)}
                        className="w-8 h-8 rounded-lg bg-brand-50 hover:bg-brand-100 flex items-center justify-center transition-colors"
                        title="Editar"
                      >
                        <svg className="w-3.5 h-3.5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
                        className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                        title="Excluir"
                      >
                        <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
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
        active ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-400 hover:text-brand-600'
      }`}
    >
      {label}
    </button>
  );
}
