import axios from 'axios';
import type { Conversation, ConversationStage } from './conversations.types';

const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api') as string;
const api = axios.create({ baseURL: BASE_URL });

export interface ConversationStartConfig {
  intervalMinSeconds: number;
  intervalMaxSeconds: number;
}

export const conversationsAPI = {
  startConversations: (phones: string[], promptBase: string, config: ConversationStartConfig) =>
    api.post<{ blastId: string; total: number }>('/conversations/start', {
      phones,
      promptBase,
      ...config,
    }),

  startStreamUrl: (blastId: string): string =>
    `${BASE_URL}/conversations/start/${blastId}/stream`,

  cancelBlast: (blastId: string) =>
    api.delete(`/conversations/start/${blastId}`),

  getAll: () => api.get<Conversation[]>('/conversations'),

  getById: (id: string) => api.get<Conversation>(`/conversations/${id}`),

  update: (id: string, data: { autoReply?: boolean; stage?: ConversationStage }) =>
    api.patch<Conversation>(`/conversations/${id}`, data),

  delete: (id: string) => api.delete(`/conversations/${id}`),
};
