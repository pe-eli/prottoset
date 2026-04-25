import { useState, useCallback } from 'react';
import { WaBlastContext, type WaBlastState } from './wa-blast-context';

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
