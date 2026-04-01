export type LeadStatus = 'new' | 'contacted' | 'replied' | 'converted' | 'ignored';
export type LeadPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  website: string;
  websiteFetchError: boolean;
  email1: string;
  email2: string;
  city: string;
  neighborhood: string;
  address: string;
  hasWebsite: boolean;
  rating: number;
  niche: string;
  priority: LeadPriority;
  status: LeadStatus;
  createdAt: string;
  // Campos opcionais para compatibilidade UI
  link?: string;
  platform?: string;
  snippet?: string;
}

export interface LeadSearchParams {
  searchTerm: string;
  city: string;
  maxResults?: number;
}

export interface LeadMetrics {
  totalLeads: number;
  leadsComWebsite: number;
  leadsSemWebsite: number;
  leadsAltaPrioridade: number;
}

export interface LeadSearchResult {
  saved: Lead[];
  duplicates: number;
  metrics: LeadMetrics;
}
