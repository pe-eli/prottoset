import { useState, useRef, useEffect } from 'react';
import type { LeadFolder } from './lead-folders.api';

// Full Tailwind class names (must be complete strings for Tailwind detection)
const PALETTE: Record<string, {
  pill: string; pillActive: string;
  dot: string; badge: string; badgeActive: string;
  deleteBtn: string;
}> = {
  blue: {
    pill: 'bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100',
    pillActive: 'bg-brand-600 border-brand-600 text-white',
    dot: 'bg-brand-500',
    badge: 'bg-brand-100 text-brand-600',
    badgeActive: 'bg-white/25 text-white',
    deleteBtn: 'bg-brand-200 hover:bg-red-400',
  },
  emerald: {
    pill: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
    pillActive: 'bg-emerald-600 border-emerald-600 text-white',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
    badgeActive: 'bg-white/25 text-white',
    deleteBtn: 'bg-emerald-200 hover:bg-red-400',
  },
  amber: {
    pill: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
    pillActive: 'bg-amber-500 border-amber-500 text-white',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700',
    badgeActive: 'bg-white/25 text-white',
    deleteBtn: 'bg-amber-200 hover:bg-red-400',
  },
  violet: {
    pill: 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100',
    pillActive: 'bg-violet-600 border-violet-600 text-white',
    dot: 'bg-violet-500',
    badge: 'bg-violet-100 text-violet-700',
    badgeActive: 'bg-white/25 text-white',
    deleteBtn: 'bg-violet-200 hover:bg-red-400',
  },
  rose: {
    pill: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100',
    pillActive: 'bg-rose-500 border-rose-500 text-white',
    dot: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-700',
    badgeActive: 'bg-white/25 text-white',
    deleteBtn: 'bg-rose-200 hover:bg-red-400',
  },
  sky: {
    pill: 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100',
    pillActive: 'bg-sky-500 border-sky-500 text-white',
    dot: 'bg-sky-500',
    badge: 'bg-sky-100 text-sky-700',
    badgeActive: 'bg-white/25 text-white',
    deleteBtn: 'bg-sky-200 hover:bg-red-400',
  },
  teal: {
    pill: 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100',
    pillActive: 'bg-teal-600 border-teal-600 text-white',
    dot: 'bg-teal-500',
    badge: 'bg-teal-100 text-teal-700',
    badgeActive: 'bg-white/25 text-white',
    deleteBtn: 'bg-teal-200 hover:bg-red-400',
  },
  orange: {
    pill: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100',
    pillActive: 'bg-orange-500 border-orange-500 text-white',
    dot: 'bg-orange-500',
    badge: 'bg-orange-100 text-orange-700',
    badgeActive: 'bg-white/25 text-white',
    deleteBtn: 'bg-orange-200 hover:bg-red-400',
  },
};

const ALL_STYLE = {
  pill: 'bg-brand-50 border-brand-100 text-brand-600 hover:bg-brand-100',
  pillActive: 'bg-brand-950 border-brand-950 text-white',
  dot: 'bg-brand-400',
  badge: 'bg-brand-100 text-brand-500',
  badgeActive: 'bg-white/20 text-white',
};

interface Props {
  folders: LeadFolder[];
  activeFolderId: string | null;
  totalLeads: number;
  leadCount: (folder: LeadFolder) => number;
  onSelect: (id: string | null) => void;
  onCreate: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function LeadFolders({
  folders,
  activeFolderId,
  totalLeads,
  leadCount,
  onSelect,
  onCreate,
  onDelete,
}: Props) {
  const safeFolders = Array.isArray(folders) ? folders : [];
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await onCreate(newName.trim());
      setNewName('');
      setCreating(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  const allActive = activeFolderId === null;

  return (
    <div className="bg-surface border border-border-light rounded-2xl shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-brand-400 uppercase tracking-widest flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
          Pastas
          <span className="ml-1 px-1.5 py-0.5 bg-brand-100 text-brand-500 rounded-md text-[10px] font-bold">
            {safeFolders.length}
          </span>
        </h4>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700 font-semibold transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova pasta
          </button>
        )}
      </div>

      {/* Inline create form */}
      {creating && (
        <div className="flex items-center gap-2 mb-3 animate-fade-in">
          <svg className="w-4 h-4 text-brand-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setCreating(false); setNewName(''); }
            }}
            placeholder="Nome da pasta..."
            className="flex-1 px-3 py-1.5 bg-surface-secondary border border-border rounded-xl text-sm
              text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-2
              focus:ring-brand-400/40 focus:border-brand-400 transition-all"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || saving}
            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold
              rounded-xl disabled:opacity-50 transition-colors"
          >
            {saving ? '...' : 'Criar'}
          </button>
          <button
            onClick={() => { setCreating(false); setNewName(''); }}
            className="w-7 h-7 flex items-center justify-center rounded-xl text-brand-400
              hover:text-brand-600 hover:bg-brand-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Folder pills */}
      <div className="flex flex-wrap gap-2">
        {/* "Todos" pill */}
        <FolderPill
          label="Todos os leads"
          count={totalLeads}
          active={allActive}
          style={ALL_STYLE}
          onClick={() => onSelect(null)}
        />

        {/* Actual folders */}
        {safeFolders.map((folder) => {
          const style = PALETTE[folder.color] ?? PALETTE['blue'];
          return (
            <FolderPill
              key={folder.id}
              label={folder.name}
              count={leadCount(folder)}
              active={activeFolderId === folder.id}
              style={style}
              onClick={() => onSelect(folder.id)}
              deleting={deletingId === folder.id}
              onDelete={() => handleDelete(folder.id)}
            />
          );
        })}
      </div>

      {safeFolders.length === 0 && !creating && (
        <p className="mt-2 text-xs text-brand-300">
          Crie pastas para organizar seus leads por categoria, campanha ou nicho.
        </p>
      )}
    </div>
  );
}

interface PillStyle {
  pill: string;
  pillActive: string;
  dot: string;
  badge: string;
  badgeActive: string;
  deleteBtn?: string;
}

interface FolderPillProps {
  label: string;
  count: number;
  active: boolean;
  style: PillStyle;
  onClick: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}

function FolderPill({ label, count, active, style, onClick, onDelete, deleting }: FolderPillProps) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`flex items-center gap-2 pl-3 pr-3 py-2 rounded-xl border font-medium
          text-sm transition-all duration-150 cursor-pointer
          ${active ? style.pillActive : style.pill}`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-white/70' : style.dot}`} />
        <span className="whitespace-nowrap">{label}</span>
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${active ? style.badgeActive : style.badge}`}>
          {count}
        </span>
      </button>

      {/* Delete button — only on hover, not when active */}
      {onDelete && !active && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          disabled={deleting}
          className={`absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full
            flex items-center justify-center opacity-0 group-hover:opacity-100
            transition-all duration-150 text-white disabled:opacity-50
            ${style.deleteBtn ?? 'bg-brand-200 hover:bg-red-400'}`}
          title="Excluir pasta"
        >
          {deleting ? (
            <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
