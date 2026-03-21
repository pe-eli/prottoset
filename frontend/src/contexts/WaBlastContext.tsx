import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { whatsappAPI } from '../features/whatsapp/whatsapp.api';

const STORAGE_KEY = 'wa_active_blast';

export interface WaBlastState {
  blastId: string;
  sent: number;
  total: number;
  phase: 'sending' | 'done' | 'cancelled';
  mode: 'direct' | 'funnel';
}

interface WaBlastContextValue {
  active: WaBlastState | null;
  setActive: (blastId: string, total: number, mode: 'direct' | 'funnel') => void;
  updateProgress: (sent: number, total: number, phase: WaBlastState['phase']) => void;
  clearActive: () => void;
}

const WaBlastContext = createContext<WaBlastContextValue>({
  active: null,
  setActive: () => {},
  updateProgress: () => {},
  clearActive: () => {},
});

export function WaBlastProvider({ children }: { children: React.ReactNode }) {
  const [active, setActiveState] = useState<WaBlastState | null>(null);
  const checkedRef = useRef(false);

  // On mount: restore from localStorage and validate against backend
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    let saved: { blastId: string; total: number; mode?: 'direct' | 'funnel' };
    try { saved = JSON.parse(stored); } catch { localStorage.removeItem(STORAGE_KEY); return; }

    const mode = saved.mode ?? 'direct';

    // Only validate direct blasts against the queue status endpoint
    // Funnel blasts don't have a backend status check — trust localStorage
    if (mode === 'direct') {
      whatsappAPI.statusBlast(saved.blastId)
        .then(({ data }) => {
          if (data.phase === 'sending') {
            setActiveState({ blastId: saved.blastId, sent: data.sent, total: data.total, phase: 'sending', mode });
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        })
        .catch(() => localStorage.removeItem(STORAGE_KEY));
    } else {
      // Funnel: restore from localStorage directly (no status endpoint)
      setActiveState({ blastId: saved.blastId, sent: 0, total: saved.total, phase: 'sending', mode });
    }
  }, []);

  const setActive = useCallback((blastId: string, total: number, mode: 'direct' | 'funnel') => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ blastId, total, mode }));
    setActiveState({ blastId, sent: 0, total, phase: 'sending', mode });
  }, []);

  const updateProgress = useCallback((sent: number, total: number, phase: WaBlastState['phase']) => {
    setActiveState((prev) => {
      if (!prev) return null;
      // Guard: never zero out a known total
      const safeTotal = total > 0 ? total : prev.total;
      return { ...prev, sent, total: safeTotal, phase };
    });
  }, []);

  const clearActive = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setActiveState(null);
  }, []);

  return (
    <WaBlastContext.Provider value={{ active, setActive, updateProgress, clearActive }}>
      {children}
    </WaBlastContext.Provider>
  );
}

export function useWaBlast() {
  return useContext(WaBlastContext);
}
