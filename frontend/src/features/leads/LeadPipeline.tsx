import { useState, useRef } from 'react';
import type { Lead, LeadStatus } from './leads.types';

const PIPELINE_COLUMNS: { status: LeadStatus; label: string; color: string; bg: string }[] = [
  { status: 'new', label: 'Novos', color: 'border-blue-400', bg: 'bg-blue-50' },
  { status: 'contacted', label: 'Contatados', color: 'border-yellow-400', bg: 'bg-yellow-50' },
  { status: 'replied', label: 'Responderam', color: 'border-purple-400', bg: 'bg-purple-50' },
  { status: 'converted', label: 'Convertidos', color: 'border-green-400', bg: 'bg-green-50' },
];

interface LeadPipelineProps {
  leads: Lead[];
  onStatusChange: (id: string, status: LeadStatus) => void;
}

export function LeadPipeline({ leads, onStatusChange }: LeadPipelineProps) {
  const safeLeads = Array.isArray(leads) ? leads : [];
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const dragOverColumn = useRef<LeadStatus | null>(null);

  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    dragOverColumn.current = status;
  };

  const handleDrop = (status: LeadStatus) => {
    if (draggedId) {
      const lead = safeLeads.find((l) => l.id === draggedId);
      if (lead && lead.status !== status) {
        onStatusChange(draggedId, status);
      }
    }
    setDraggedId(null);
    dragOverColumn.current = null;
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    dragOverColumn.current = null;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {PIPELINE_COLUMNS.map((col) => {
        const columnLeads = safeLeads.filter((l) => l.status === col.status);

        return (
          <div
            key={col.status}
            onDragOver={(e) => handleDragOver(e, col.status)}
            onDrop={() => handleDrop(col.status)}
            className="flex flex-col"
          >
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className={`w-2 h-2 rounded-full ${col.bg} border-2 ${col.color}`} />
              <h4 className="text-xs font-semibold text-brand-500 uppercase tracking-wide">
                {col.label}
              </h4>
              <span className="text-xs text-brand-300 ml-auto">{columnLeads.length}</span>
            </div>

            {/* Cards container */}
            <div className="flex-1 space-y-2 min-h-[120px] bg-brand-50/30 rounded-2xl p-2 border border-dashed border-brand-100">
              {columnLeads.length === 0 && (
                <div className="flex items-center justify-center h-full min-h-[100px]">
                  <p className="text-xs text-brand-200">Arraste leads aqui</p>
                </div>
              )}
              {columnLeads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={() => handleDragStart(lead.id)}
                  onDragEnd={handleDragEnd}
                  className={`bg-surface border border-border-light rounded-xl p-3 cursor-grab active:cursor-grabbing
                    shadow-sm hover:shadow-md hover:shadow-brand-100/50 transition-all
                    ${draggedId === lead.id ? 'opacity-40' : ''}
                  `}
                >
                  {lead.website ? (
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-brand-950 hover:text-brand-600 transition-colors block truncate"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {lead.name}
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-brand-950 block truncate">
                      {lead.name}
                    </span>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    {lead.neighborhood && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-brand-50 text-brand-500 rounded-md font-medium truncate">
                        {lead.neighborhood}
                      </span>
                    )}
                    <span className="text-[10px] text-brand-300 truncate">{lead.city}</span>
                  </div>
                  {lead.email1 && (
                    <p className="text-[11px] text-orange-500 mt-2 truncate">{lead.email1}</p>
                  )}
                  {!lead.hasWebsite && (
                    <span className="inline-block text-[10px] mt-1.5 px-1.5 py-0.5 bg-red-50 text-red-500 rounded-md font-medium">
                      sem site
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
