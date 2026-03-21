import { Lead, LeadSearchParams, LeadSearchResult, LeadStatus } from '../../types/leads.types';
import { leadsRepository } from './leads.repository';
import { generateLeads } from '../../workflow/leadGenerator';

export const leadsService = {
  async search(params: LeadSearchParams): Promise<LeadSearchResult> {
    const { leads, metrics } = await generateLeads(params);
    const saved = await leadsRepository.saveMany(leads);

    return {
      saved,
      duplicates: leads.length - saved.length,
      metrics,
    };
  },

  async getAll(): Promise<Lead[]> {
    return leadsRepository.getAll();
  },

  async getById(id: string): Promise<Lead | null> {
    return leadsRepository.getById(id);
  },

  async updateStatus(id: string, status: LeadStatus): Promise<Lead | null> {
    return leadsRepository.updateStatus(id, status);
  },

  async delete(id: string): Promise<boolean> {
    return leadsRepository.delete(id);
  },
};
