import { api, API_BASE_URL } from '../../lib/axios';

export type ContactStatus = 'new' | 'contacted' | 'negotiating' | 'client' | 'lost';
export type ContactChannel = 'email' | 'whatsapp' | 'manual';

export interface Contact {
  id: string;
  email: string;
  name: string;
  phone: string;
  company: string;
  status: ContactStatus;
  notes: string;
  channel?: ContactChannel;
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlastConfig {
  batchSize: number;
  intervalMinSeconds: number;
  intervalMaxSeconds: number;
  resendApiKey: string;
  resendFrom: string;
}

export const contactsAPI = {
  getAll: () => api.get<Contact[]>('/contacts'),

  getById: (id: string) => api.get<Contact>(`/contacts/${id}`),

  create: (emails: string[]) =>
    api.post<{ saved: Contact[]; duplicates: number }>('/contacts', { emails }),

  update: (id: string, data: Partial<Pick<Contact, 'name' | 'phone' | 'company' | 'status' | 'notes'>>) =>
    api.patch<Contact>(`/contacts/${id}`, data),

  delete: (id: string) => api.delete(`/contacts/${id}`),

  /** Inicia o blast e retorna o blastId para acompanhar via SSE */
  startBlast: (emails: string[], subject: string, body: string, config: BlastConfig) =>
    api.post<{ blastId: string; total: number }>('/contacts/blast', { emails, subject, body, ...config }),

  /** URL do SSE stream de progresso */
  blastStreamUrl: (blastId: string) => `${API_BASE_URL}/contacts/blast/${blastId}/stream`,
};
