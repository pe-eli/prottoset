import { Card } from '../../components/ui/Card';
import type { Lead, LeadStatus } from './leads.types';

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Novo',
  contacted: 'Contatado',
  replied: 'Respondeu',
  converted: 'Convertido',
  ignored: 'Ignorado',
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-50 text-blue-700',
  contacted: 'bg-yellow-50 text-yellow-700',
  replied: 'bg-purple-50 text-purple-700',
  converted: 'bg-green-50 text-green-700',
  ignored: 'bg-gray-100 text-gray-500',
};

interface LeadResultsTableProps {
  leads: Lead[];
  onStatusChange: (id: string, status: LeadStatus) => void;
  onDelete: (id: string) => void;
}

export function LeadResultsTable({ leads, onStatusChange, onDelete }: LeadResultsTableProps) {
  if (leads.length === 0) {
    return (
      <Card className="text-center py-12">
        <div className="text-gray-400">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm">Nenhum lead encontrado.</p>
          <p className="text-xs mt-1">Use o formulário acima para buscar leads.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden !p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nome</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Plataforma</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Snippet</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nicho</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cidade</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <a
                    href={lead.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-gray-900 hover:text-brand-600 transition-colors"
                  >
                    {lead.name}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                    {lead.platform}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <p className="text-xs text-gray-500 line-clamp-2 max-w-xs">{lead.snippet}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{lead.niche}</td>
                <td className="px-4 py-3 text-gray-600">{lead.city}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[lead.status]}`}>
                    {STATUS_LABELS[lead.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {lead.status === 'new' && (
                      <ActionButton
                        label="Contatar"
                        onClick={() => onStatusChange(lead.id, 'contacted')}
                        color="text-yellow-600 hover:bg-yellow-50"
                      />
                    )}
                    {lead.status === 'contacted' && (
                      <ActionButton
                        label="Respondeu"
                        onClick={() => onStatusChange(lead.id, 'replied')}
                        color="text-purple-600 hover:bg-purple-50"
                      />
                    )}
                    {(lead.status === 'replied' || lead.status === 'contacted') && (
                      <ActionButton
                        label="Converter"
                        onClick={() => onStatusChange(lead.id, 'converted')}
                        color="text-green-600 hover:bg-green-50"
                      />
                    )}
                    {lead.status !== 'ignored' && lead.status !== 'converted' && (
                      <ActionButton
                        label="Ignorar"
                        onClick={() => onStatusChange(lead.id, 'ignored')}
                        color="text-gray-400 hover:bg-gray-100"
                      />
                    )}
                    <ActionButton
                      label="Excluir"
                      onClick={() => onDelete(lead.id)}
                      color="text-red-400 hover:bg-red-50"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ActionButton({ label, onClick, color }: { label: string; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-1 rounded-md transition-colors ${color}`}
    >
      {label}
    </button>
  );
}
