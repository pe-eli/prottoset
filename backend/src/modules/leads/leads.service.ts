import { Lead, LeadSearchParams, LeadSearchResult, LeadStatus } from '../../types/leads.types';
import { leadsRepository } from './leads.repository';
import { generateLeads } from '../../workflow/leadGenerator';

export const leadsService = {
  async search(params: LeadSearchParams): Promise<LeadSearchResult> {
    const { leads, metrics } = await generateLeads(params);
    const saved = leadsRepository.saveMany(leads);

    return {
      saved,
      duplicates: leads.length - saved.length,
      metrics,
    };
  },

  getAll(): Lead[] {
    return leadsRepository.getAll();
  },

  getById(id: string): Lead | null {
    return leadsRepository.getById(id);
  },

  updateStatus(id: string, status: LeadStatus): Lead | null {
    return leadsRepository.updateStatus(id, status);
  },

  delete(id: string): boolean {
    return leadsRepository.delete(id);
  },
};
