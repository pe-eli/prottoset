import { useContext } from 'react';
import { WaBlastContext } from './wa-blast-context';

export function useWaBlast() {
  return useContext(WaBlastContext);
}
