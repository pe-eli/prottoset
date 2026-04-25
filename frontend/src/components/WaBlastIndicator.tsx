import { useNavigate } from 'react-router-dom';
import { useWaBlast } from '../contexts/useWaBlast';

export function WaBlastIndicator() {
  const { active } = useWaBlast();
  const navigate = useNavigate();

  if (!active || active.phase !== 'sending') return null;

  const pct = active.total > 0 ? Math.round((active.sent / active.total) * 100) : 0;

  return (
    <div
      className="fixed top-4 right-4 z-[100] animate-fade-in"
      style={{ maxWidth: '260px' }}
    >
      <div className="bg-white border border-border-light rounded-2xl shadow-xl shadow-brand-200/50 overflow-hidden">
        {/* Progress bar across top */}
        <div className="h-1 bg-brand-100 w-full">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="px-4 py-3 flex items-center gap-3">
          {/* Spinner */}
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-emerald-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-brand-950">Disparo em andamento</p>
            <p className="text-[11px] text-brand-400">
              {active.sent} de {active.total} enviados · {pct}%
            </p>
          </div>

          <button
            onClick={() => navigate('/leads/whatsapp')}
            className="text-[11px] text-brand-500 hover:text-brand-700 font-semibold transition-colors shrink-0"
          >
            Ver →
          </button>
        </div>
      </div>
    </div>
  );
}
