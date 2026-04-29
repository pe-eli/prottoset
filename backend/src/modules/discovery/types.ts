export type DiscoverySearchStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface DiscoverySearchRecord {
  id: string;
  tenantId: string;
  query: string;
  status: DiscoverySearchStatus;
  provider: string;
  requestedMaxResults: number;
  discoveredUrls: number;
  extractedProfiles: number;
  normalizedLeads: number;
  duplicates: number;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
}

export interface DiscoverySearchCandidate {
  title: string;
  snippet: string;
  url: string;
  instagramUrl: string | null;
}

export interface DiscoverySearchProvider {
  searchInstagramCandidates(query: string, maxResults: number): Promise<DiscoverySearchCandidate[]>;
}

export interface InstagramProfileExtracted {
  username: string;
  fullName: string;
  biography: string;
  externalUrl: string;
  followers: number | null;
  profilePicUrl: string;
  profileUrl: string;
  source: string;
}

export interface NormalizedLeadInput {
  username: string;
  normalizedUsername: string;
  fullName: string;
  biography: string;
  externalUrl: string;
  followers: number | null;
  profilePicUrl: string;
  profileUrl: string;
  source: string;
}

export interface DiscoverySearchSummary {
  id: string;
  status: DiscoverySearchStatus;
  query: string;
  requestedMaxResults: number;
  discoveredUrls: number;
  extractedProfiles: number;
  normalizedLeads: number;
  duplicates: number;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}
