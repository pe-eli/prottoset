import { api, API_BASE_URL } from '../../lib/axios';

export type ContactStatus = 'new' | 'contacted' | 'no_reply' | 'interested' | 'negotiating' | 'client' | 'lost';
export type ContactChannel = 'email' | 'whatsapp' | 'manual';

export type ActivityType =
  | 'MESSAGE_SENT'
  | 'FOLLOWUP_CREATED'
  | 'NOTE_CREATED'
  | 'STATUS_CHANGED'
  | 'CAMPAIGN_SENT'
  | 'CONTACT_CREATED'
  | 'MANUAL_INTERACTION';

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
  lastReadAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactActivity {
  id: string;
  contactId: string;
  type: ActivityType;
  title: string;
  description?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  contactId: string;
  channel: ContactChannel;
  direction: 'inbound' | 'outbound';
  content: string;
  sentAt: string;
  createdAt: string;
}

export interface BlastConfig {
  batchSize: number;
  intervalMinSeconds: number;
  intervalMaxSeconds: number;
  resendApiKey?: string;
  resendFrom?: string;
}

export const contactsAPI = {
  getAll: () => api.get<Contact[]>('/contacts'),

  getById: (id: string) => api.get<Contact>(`/contacts/${id}`),

  create: (emails: string[]) =>
    api.post<{ saved: Contact[]; duplicates: number }>('/contacts', { emails }),

  update: (id: string, data: Partial<Pick<Contact, 'name' | 'phone' | 'company' | 'status' | 'notes'>>) =>
    api.patch<Contact>(`/contacts/${id}`, data),

  delete: (id: string) => api.delete(`/contacts/${id}`),

  getActivities: (id: string) =>
    api.get<ContactActivity[]>(`/contacts/${id}/activities`),

  addNote: (id: string, content: string) =>
    api.post<ContactActivity>(`/contacts/${id}/notes`, { content }),

  createFollowup: (id: string, data: { scheduledFor: string; note?: string; priority?: 'low' | 'normal' | 'high' }) =>
    api.post<ContactActivity>(`/contacts/${id}/followups`, data),

  completeFollowup: (contactId: string, activityId: string, done: boolean) =>
    api.patch<ContactActivity>(`/contacts/${contactId}/followups/${activityId}`, { done }),

  // Legacy — kept for backwards compatibility
  getMessages: (id: string) =>
    api.get<ContactMessage[]>(`/contacts/${id}/messages`),

  markRead: (id: string) =>
    api.post<{ ok: boolean; lastReadAt?: string }>(`/contacts/${id}/read`),

  replyWhatsapp: (id: string, data: {
    messageMode: 'ai' | 'manual';
    promptBase?: string;
    manualMessage?: string;
  }) => api.post<{ ok: boolean; message: string }>(`/contacts/${id}/reply`, data),

  /** Inicia o blast e retorna o blastId para acompanhar via SSE */
  startBlast: (emails: string[], subject: string, body: string, config: BlastConfig) =>
    api.post<{ blastId: string; total: number }>('/contacts/blast', { emails, subject, body, ...config }),

  /** URL do SSE stream de progresso */
  blastStreamUrl: (blastId: string) => `${API_BASE_URL}/contacts/blast/${blastId}/stream`,
};
