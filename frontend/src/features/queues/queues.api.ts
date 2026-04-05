import axios from 'axios';
import type { PhoneQueue } from './queues.types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

export const queuesAPI = {
  getAll: () => api.get<PhoneQueue[]>('/queues'),

  create: (name: string) => api.post<PhoneQueue>('/queues', { name }),

  delete: (id: string) => api.delete(`/queues/${id}`),

  rename: (id: string, name: string) =>
    api.patch<PhoneQueue>(`/queues/${id}`, { name }),

  merge: (sourceIds: string[], name: string) =>
    api.post<PhoneQueue>('/queues/merge', { sourceIds, name }),

  addPhones: (id: string, phones: string[]) =>
    api.post<PhoneQueue>(`/queues/${id}/phones`, { phones }),

  removePhone: (id: string, phone: string) =>
    api.delete<PhoneQueue>(`/queues/${id}/phones/${encodeURIComponent(phone)}`),
};
