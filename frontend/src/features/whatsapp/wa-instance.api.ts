import { api } from '../../lib/axios';

export interface WaInstanceStatus {
  status: 'not_created' | 'connecting' | 'connected' | 'disconnected';
  phone: string | null;
  instanceName: string | null;
}

export interface WaConnectResponse {
  status: 'connecting' | 'already_connected';
  qrCode?: string;
  phone?: string;
}

export const waInstanceAPI = {
  getStatus: () =>
    api.get<WaInstanceStatus>('/whatsapp/instance'),

  connect: () =>
    api.post<WaConnectResponse>('/whatsapp/connect'),

  disconnect: () =>
    api.post<{ status: 'disconnected' }>('/whatsapp/disconnect'),
};
