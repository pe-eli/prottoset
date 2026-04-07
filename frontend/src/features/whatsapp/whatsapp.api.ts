import axios from 'axios';

const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api') as string;
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

export interface WaBlastConfig {
  batchSize: number;
  intervalMinSeconds: number;
  intervalMaxSeconds: number;
  promptBase: string;
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

  blastStreamUrl: (blastId: string): string =>
    `${BASE_URL}/whatsapp/blast/${blastId}/stream`,
};
