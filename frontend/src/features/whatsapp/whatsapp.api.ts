import { api, API_BASE_URL } from '../../lib/axios';

export interface WaBlastConfig {
  batchSize: number;
  intervalMinSeconds: number;
  intervalMaxSeconds: number;
  messageMode: 'ai' | 'manual';
  promptBase?: string;
  manualMessage?: string;
}

export const whatsappAPI = {
  startBlast: (phones: string[], config: WaBlastConfig) =>
    api.post<{ blastId: string; total: number }>('/whatsapp/blast', {
      phones,
      ...config,
    }),

  cancelBlast: (blastId: string) =>
    api.post<{ cancelled: boolean }>(`/whatsapp/blast/${blastId}/cancel`),

  statusBlast: (blastId: string) =>
    api.get<{ phase: string; sent: number; total: number }>(`/whatsapp/blast/${blastId}/status`),

  testPrompt: (promptBase: string) =>
    api.post<{ messages: string[] }>('/whatsapp/prompt/test', { promptBase }),

  blastStreamUrl: (blastId: string): string =>
    `${API_BASE_URL}/whatsapp/blast/${blastId}/stream`,
};
