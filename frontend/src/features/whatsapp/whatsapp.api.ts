import axios from 'axios';

const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api') as string;
const api = axios.create({ baseURL: BASE_URL });

export interface WaBlastConfig {
  batchSize: number;
  intervalMinSeconds: number;
  intervalMaxSeconds: number;
}

export const whatsappAPI = {
  startBlast: (phones: string[], promptBase: string, config: WaBlastConfig) =>
    api.post<{ blastId: string; total: number }>('/whatsapp/blast', {
      phones,
      promptBase,
      ...config,
    }),

  blastStreamUrl: (blastId: string): string =>
    `${BASE_URL}/whatsapp/blast/${blastId}/stream`,
};
