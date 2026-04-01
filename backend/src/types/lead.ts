export type LeadStatus = 'new' | 'contacted' | 'replied' | 'converted' | 'ignored';

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
  rating: number;
  niche: string;
  status: LeadStatus;
  createdAt: string;
}

export interface LeadSearchParams {
  searchTerm: string;
  city: string;
}
