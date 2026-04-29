import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../security/rate-limit.store', () => ({
  consumeRateLimit: vi.fn(),
}));

vi.mock('../../../jobs/queues', () => ({
  enqueueDiscoverySearchJob: vi.fn(async () => {}),
}));

vi.mock('../repositories/discovery.repository', () => ({
  discoveryRepository: {
    createSearch: vi.fn(),
    getSearchById: vi.fn(),
    getDiscoveryLeadsBySearchId: vi.fn(),
  },
}));

vi.mock('../../../observability/structured-logger', () => ({
  structuredLogger: {
    event: vi.fn(),
  },
}));

import { consumeRateLimit } from '../../../security/rate-limit.store';
import { enqueueDiscoverySearchJob } from '../../../jobs/queues';
import { discoveryRepository } from '../repositories/discovery.repository';
import { discoveryService } from '../discovery.service';

describe('discoveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aplica rate limiting diario por tenant', async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      retryAfterMs: 30_000,
    } as never);

    await expect(discoveryService.createSearch('tenant-1', 'gestor de trafego', 20)).rejects.toMatchObject({ status: 429 });
    expect(enqueueDiscoverySearchJob).not.toHaveBeenCalled();
  });

  it('cria busca com provider duckduckgo e enfileira job assincrono', async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      retryAfterMs: 0,
    } as never);

    vi.mocked(discoveryRepository.createSearch).mockResolvedValue({
      id: 'search-1',
      tenantId: 'tenant-1',
      query: 'social media americana',
      status: 'queued',
      provider: 'duckduckgo',
      requestedMaxResults: 20,
      discoveredUrls: 0,
      extractedProfiles: 0,
      normalizedLeads: 0,
      duplicates: 0,
      errorMessage: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      updatedAt: new Date().toISOString(),
    } as never);

    const created = await discoveryService.createSearch('tenant-1', 'social media americana', 20);

    expect(created.id).toBe('search-1');
    expect(discoveryRepository.createSearch).toHaveBeenCalledWith('tenant-1', 'social media americana', 20, 'duckduckgo');
    expect(enqueueDiscoverySearchJob).toHaveBeenCalledWith({ tenantId: 'tenant-1', searchId: 'search-1' });
  });
});
