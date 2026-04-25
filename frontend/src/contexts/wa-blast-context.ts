import { createContext } from 'react';

export interface WaBlastState {
  blastId: string;
  sent: number;
  total: number;
  phase: 'sending' | 'done' | 'cancelled';
}

export interface WaBlastContextValue {
  active: WaBlastState | null;
  setActive: (blastId: string, total: number) => void;
  updateProgress: (sent: number, total: number, phase: WaBlastState['phase']) => void;
  clearActive: () => void;
}

export const WaBlastContext = createContext<WaBlastContextValue>({
  active: null,
  setActive: () => {},
  updateProgress: () => {},
  clearActive: () => {},
});
