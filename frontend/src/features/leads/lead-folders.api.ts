import { api } from '../../lib/axios';

export interface LeadFolder {
  id: string;
  name: string;
  leadIds: string[];
  color: string;
  createdAt: string;
}

export const foldersAPI = {
  getAll: () => api.get<LeadFolder[]>('/lead-folders'),
  create: (name: string) => api.post<LeadFolder>('/lead-folders', { name }),
  delete: (id: string) => api.delete(`/lead-folders/${id}`),
  addLeads: (id: string, leadIds: string[]) =>
    api.post<LeadFolder>(`/lead-folders/${id}/leads`, { leadIds }),
  removeLeads: (id: string, leadIds: string[]) =>
    api.delete<LeadFolder>(`/lead-folders/${id}/leads`, { data: { leadIds } }),
};
