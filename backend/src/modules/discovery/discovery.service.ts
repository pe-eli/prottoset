import { consumeRateLimit } from '../../security/rate-limit.store';
import { structuredLogger } from '../../observability/structured-logger';
import { enqueueDiscoverySearchJob } from '../../jobs/queues';
import { DISCOVERY_PROVIDER_DUCKDUCKGO } from './discovery.constants';
import { discoveryRepository } from './repositories/discovery.repository';
import { DiscoverySearchSummary } from './types';

const TENANT_DAILY_SEARCH_LIMIT = Math.max(1, Number(process.env.DISCOVERY_DAILY_SEARCH_LIMIT || 80));
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

function toSummary(search: {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
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
}): DiscoverySearchSummary {
  return {
    id: search.id,
    status: search.status,
    query: search.query,
    requestedMaxResults: search.requestedMaxResults,
    discoveredUrls: search.discoveredUrls,
    extractedProfiles: search.extractedProfiles,
    normalizedLeads: search.normalizedLeads,
    duplicates: search.duplicates,
    errorMessage: search.errorMessage,
    createdAt: search.createdAt,
    startedAt: search.startedAt,
    finishedAt: search.finishedAt,
  };
}

export const discoveryService = {
  async createSearch(tenantId: string, query: string, maxResults: number): Promise<DiscoverySearchSummary> {
    const limiter = await consumeRateLimit(`discovery:tenant:${tenantId}:daily`, TENANT_DAILY_SEARCH_LIMIT, DAILY_WINDOW_MS);
    if (!limiter.allowed) {
      const seconds = Math.ceil(limiter.retryAfterMs / 1000);
      const error = new Error(`Limite diário de buscas Discovery atingido. Tente novamente em ${seconds}s.`);
      (error as Error & { status?: number }).status = 429;
      throw error;
    }

    const safeMaxResults = Math.max(1, Math.min(80, Math.floor(maxResults || 20)));
    const created = await discoveryRepository.createSearch(tenantId, query, safeMaxResults, DISCOVERY_PROVIDER_DUCKDUCKGO);

    await enqueueDiscoverySearchJob({
      tenantId,
      searchId: created.id,
    });

    structuredLogger.event('discovery_search_enqueued', {
      tenantId,
      searchId: created.id,
      query,
      maxResults: safeMaxResults,
    });

    return toSummary(created);
  },

  async getSearch(tenantId: string, searchId: string): Promise<DiscoverySearchSummary | null> {
    const search = await discoveryRepository.getSearchById(tenantId, searchId);
    if (!search) return null;
    return toSummary(search);
  },

  async getSearchLeads(tenantId: string, searchId: string) {
    const [search, leads] = await Promise.all([
      discoveryRepository.getSearchById(tenantId, searchId),
      discoveryRepository.getDiscoveryLeadsBySearchId(tenantId, searchId),
    ]);

    if (!search) {
      return null;
    }

    return {
      search: toSummary(search),
      saved: leads,
      duplicates: search.duplicates,
      metrics: {
        totalLeads: search.discoveredUrls,
        leadsComWebsite: leads.filter((lead) => Boolean(lead.website)).length,
        leadsSemWebsite: leads.filter((lead) => !lead.website).length,
        leadsAltaPrioridade: leads.filter((lead) => lead.priority === 'HIGH').length,
      },
    };
  },
};
