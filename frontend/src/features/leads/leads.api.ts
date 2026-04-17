import { api } from '../../lib/axios';
import type { Lead, LeadSearchParams, LeadSearchResult, LeadStatus } from './leads.types';

export interface LeadsDailyQuota {
  key: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  applied: boolean;
}

export interface LeadsSearchQuotaResponse {
  hasActiveSubscription: boolean;
  dailyLeadsQuota: LeadsDailyQuota;
}

export const leadsAPI = {
  getSearchQuota: () =>
    api.get<LeadsSearchQuotaResponse>('/leads/search-quota'),

  search: (params: LeadSearchParams) =>
    api.post<LeadSearchResult>('/leads/search', params),

  getAll: () =>
    api.get<Lead[]>('/leads'),

  updateStatus: (id: string, status: LeadStatus) =>
    api.patch<Lead>(`/leads/${id}/status`, { status }),

  delete: (id: string) =>
    api.delete(`/leads/${id}`),
};
