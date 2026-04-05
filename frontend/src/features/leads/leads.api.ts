import axios from 'axios';
import type { Lead, LeadSearchParams, LeadSearchResult, LeadStatus } from './leads.types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
});

export const leadsAPI = {
  search: (params: LeadSearchParams) =>
    api.post<LeadSearchResult>('/leads/search', params),

  getAll: () =>
    api.get<Lead[]>('/leads'),

  updateStatus: (id: string, status: LeadStatus) =>
    api.patch<Lead>(`/leads/${id}/status`, { status }),

  delete: (id: string) =>
    api.delete(`/leads/${id}`),
};
