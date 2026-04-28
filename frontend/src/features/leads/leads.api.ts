import { api } from '../../lib/axios';
import type {
  DiscoverySearchCreateResponse,
  DiscoverySearchResultsResponse,
  DiscoverySearchSummary,
  Lead,
  LeadSearchParams,
  LeadSearchResult,
  LeadStatus,
} from './leads.types';

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

  discoverySearch: (query: string, maxResults?: number) =>
    api.post<DiscoverySearchCreateResponse>('/leads/discovery/search', { query, maxResults }),

  getDiscoverySearch: (searchId: string) =>
    api.get<DiscoverySearchSummary>(`/leads/discovery/searches/${searchId}`),

  getDiscoveryResults: (searchId: string) =>
    api.get<DiscoverySearchResultsResponse>(`/leads/discovery/searches/${searchId}/results`),

  getAll: () =>
    api.get<Lead[]>('/leads'),

  updateStatus: (id: string, status: LeadStatus) =>
    api.patch<Lead>(`/leads/${id}/status`, { status }),

  delete: (id: string) =>
    api.delete(`/leads/${id}`),
};
