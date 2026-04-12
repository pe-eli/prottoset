import { api } from '../lib/axios';
import type { Quote } from '../types';

export const quoteAPI = {
  generatePdf: (quote: Quote) =>
    api.post<{ id: string; pdfUrl: string }>('/quotes/generate-pdf', quote),

  downloadPdf: (id: string) =>
    api.get(`/quotes/${id}/pdf`, { responseType: 'blob' }),

  list: () => api.get<Quote[]>('/quotes'),

  get: (id: string) => api.get<Quote>(`/quotes/${id}`),
};
