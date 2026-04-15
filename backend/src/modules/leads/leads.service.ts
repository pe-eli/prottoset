import { Lead, LeadSearchParams, LeadSearchResult, LeadStatus } from '../../types/leads.types';
import { leadsRepository } from './leads.repository';
import { generateLeads } from '../../workflow/leadGenerator';
import { usageRepository } from '../subscriptions/usage.repository';

export const leadsService = {
  async search(tenantId: string, params: LeadSearchParams): Promise<LeadSearchResult> {
    const { leads, metrics } = await generateLeads(params);
    const saved = await leadsRepository.saveMany(tenantId, leads);

    if (saved.length > 0) {
      await usageRepository.incrementUsage(tenantId, 'leads_used', saved.length);
    }

    return {
      saved,
      duplicates: leads.length - saved.length,
      metrics,
    };
  },

  async getAll(tenantId: string): Promise<Lead[]> {
    return leadsRepository.getAll(tenantId);
  },

  async getById(tenantId: string, id: string): Promise<Lead | null> {
    return leadsRepository.getById(tenantId, id);
  },

  async updateStatus(tenantId: string, id: string, status: LeadStatus): Promise<Lead | null> {
    return leadsRepository.updateStatus(tenantId, id, status);
  },

  async delete(tenantId: string, id: string): Promise<boolean> {
    return leadsRepository.delete(tenantId, id);
  },
};
