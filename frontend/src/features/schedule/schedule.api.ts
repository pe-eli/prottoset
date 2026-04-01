import axios from 'axios';
import type { ScheduleItem, CreateScheduleItemParams } from './schedule.types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
});

export const scheduleAPI = {
  getAll: () => api.get<ScheduleItem[]>('/schedule'),

  getById: (id: string) => api.get<ScheduleItem>(`/schedule/${id}`),

  create: (params: CreateScheduleItemParams) => api.post<ScheduleItem>('/schedule', params),

  update: (id: string, params: Partial<CreateScheduleItemParams>) =>
    api.patch<ScheduleItem>(`/schedule/${id}`, params),

  delete: (id: string) => api.delete(`/schedule/${id}`),
};
