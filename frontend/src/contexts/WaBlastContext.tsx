import { createContext, useContext, useState, useCallback } from 'react';

export interface WaBlastState {
  blastId: string;
  sent: number;
  total: number;
  phase: 'sending' | 'done' | 'cancelled';
}

interface WaBlastContextValue {
  active: WaBlastState | null;
  setActive: (blastId: string, total: number) => void;
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

  const setActive = useCallback((blastId: string, total: number) => {
    setActiveState({ blastId, sent: 0, total, phase: 'sending' });
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
