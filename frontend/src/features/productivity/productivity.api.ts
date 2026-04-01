import axios from 'axios';
import type { DailyEntry, CreateDailyEntryParams } from './productivity.types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
});

export const productivityAPI = {
  getAll: () => api.get<DailyEntry[]>('/productivity'),

  getById: (id: string) => api.get<DailyEntry>(`/productivity/${id}`),

  getByWeek: (week: string) => api.get<DailyEntry[]>(`/productivity/week/${week}`),

  create: (params: CreateDailyEntryParams) => api.post<DailyEntry>('/productivity', params),

  update: (id: string, params: Partial<CreateDailyEntryParams>) =>
    api.patch<DailyEntry>(`/productivity/${id}`, params),

  delete: (id: string) => api.delete(`/productivity/${id}`),
};
