import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { contactsAPI, type Contact, type ContactStatus } from '../features/contacts/contacts.api';

const STATUS_CONFIG: Record<ContactStatus, { label: string; color: string; bg: string }> = {
  new: { label: 'Novo', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  contacted: { label: 'Contatado', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  negotiating: { label: 'Negociando', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  client: { label: 'Cliente', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  lost: { label: 'Perdido', color: 'text-gray-500', bg: 'bg-gray-100 border-gray-200' },
};

const STATUS_OPTIONS: ContactStatus[] = ['new', 'contacted', 'negotiating', 'client', 'lost'];

const FALLBACK_STATUS = STATUS_CONFIG['new'];
function getStatusConfig(status: string) {
  return STATUS_CONFIG[status as ContactStatus] ?? FALLBACK_STATUS;
}

export function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', company: '', notes: '' });
  const [filter, setFilter] = useState<ContactStatus | 'all'>('all');

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await contactsAPI.getAll();
      setContacts(data);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setEditForm({
      name: contact.name,
      phone: contact.phone,
      company: contact.company,
      notes: contact.notes,
    });
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

  const filtered = filter === 'all' ? contacts : contacts.filter((c) => c.status === filter);

  const stats = {
    total: contacts.length,
    new: contacts.filter((c) => c.status === 'new').length,
    contacted: contacts.filter((c) => c.status === 'contacted').length,
    client: contacts.filter((c) => c.status === 'client').length,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
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
            <h2 className="text-2xl font-bold text-brand-950">Contatos</h2>
            <p className="text-sm text-brand-400">Gerencie seus potenciais clientes</p>
          </div>
        </div>
        <Link to="/leads/disparos">
          <Button variant="outline" size="sm">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Novo Disparo
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} gradient="from-brand-600 to-brand-400" />
        <StatCard label="Novos" value={stats.new} gradient="from-blue-500 to-cyan-400" />
        <StatCard label="Contatados" value={stats.contacted} gradient="from-amber-500 to-yellow-400" />
        <StatCard label="Clientes" value={stats.client} gradient="from-emerald-500 to-teal-400" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 bg-brand-50 rounded-xl p-1 w-fit">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="Todos" />
        {STATUS_OPTIONS.map((s) => (
          <FilterButton
            key={s}
            active={filter === s}
            onClick={() => setFilter(s)}
            label={STATUS_CONFIG[s].label}
          />
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
            Use o <Link to="/leads/disparos" className="text-brand-500 hover:underline">Disparo de E-mails</Link> para adicionar contatos
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((contact) => (
            <Card key={contact.id} hover className="!p-0">
              {editingId === contact.id ? (
                /* Edit mode */
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-brand-950">{contact.email}</span>
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
                /* View mode */
                <div className="p-4 flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-400 flex items-center justify-center shrink-0 shadow-sm shadow-brand-500/20">
                    <span className="text-white font-bold text-sm">
                      {(contact.name || contact.email).charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-brand-950">
                        {contact.name || contact.email}
                      </h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${getStatusConfig(contact.status).bg} ${getStatusConfig(contact.status).color}`}>
                        {getStatusConfig(contact.status).label}
                      </span>
                    </div>
                    {contact.name && (
                      <p className="text-xs text-brand-400 mt-0.5">{contact.email}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {contact.phone && (
                        <span className="text-[11px] text-green-600 bg-green-50 px-2 py-0.5 rounded-lg font-medium">
                          {contact.phone}
                        </span>
                      )}
                      {contact.company && (
                        <span className="text-[11px] text-brand-500 bg-brand-50 px-2 py-0.5 rounded-lg font-medium">
                          {contact.company}
                        </span>
                      )}
                    </div>
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
          ))}
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
        active
          ? 'bg-white text-brand-700 shadow-sm'
          : 'text-brand-400 hover:text-brand-600'
      }`}
    >
      {label}
    </button>
  );
}
