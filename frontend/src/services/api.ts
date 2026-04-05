import axios from 'axios';
import type { Quote } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
});

export const quoteAPI = {
  generatePdf: (quote: Quote) =>
    api.post<{ id: string; pdfUrl: string }>('/quotes/generate-pdf', quote),

  downloadPdf: (id: string) =>
    api.get(`/quotes/${id}/pdf`, { responseType: 'blob' }),

  list: () => api.get<Quote[]>('/quotes'),

  get: (id: string) => api.get<Quote>(`/quotes/${id}`),
};
