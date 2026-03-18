import { useMemo } from 'react';
import type { SelectedService, SelectedExtra } from '../types';

export function useQuoteCalculation(services: SelectedService[], extras: SelectedExtra[]) {
  const subtotalServices = useMemo(
    () => services.reduce((sum, s) => sum + s.service.basePrice * s.quantity, 0),
    [services],
  );

  const subtotalExtras = useMemo(
    () => extras.reduce((sum, e) => sum + e.extra.price, 0),
    [extras],
  );

  const total = subtotalServices + subtotalExtras;

  return { subtotalServices, subtotalExtras, total };
}
