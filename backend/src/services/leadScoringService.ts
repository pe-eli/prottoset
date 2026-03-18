import type { LeadPriority } from '../types/leads.types';

/**
 * Calcula a prioridade de um lead baseado na presença de website e telefone.
 *
 * - HIGH:   sem website + com telefone → maior potencial de venda de sites
 * - MEDIUM: com website + com telefone
 * - LOW:    sem telefone
 */
export const leadScoringService = {
  calculatePriority(hasWebsite: boolean, hasPhone: boolean): LeadPriority {
    if (!hasPhone) return 'LOW';
    if (!hasWebsite) return 'HIGH';
    return 'MEDIUM';
  },
};
