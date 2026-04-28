import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/discovery.repository', () => ({
  discoveryRepository: {
    findInstagramProfileByNormalizedUsername: vi.fn(),
  },
}));

import { discoveryRepository } from '../repositories/discovery.repository';
import { leadDeduplicationService } from '../dedup/lead-deduplication.service';

describe('leadDeduplicationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna true quando username normalizado ja possui lead vinculado', async () => {
    vi.mocked(discoveryRepository.findInstagramProfileByNormalizedUsername).mockResolvedValue({
      id: 'profile-1',
      leadId: 'lead-1',
    } as never);

    const exists = await leadDeduplicationService.existsByNormalizedUsername('tenant-1', 'closragency');
    expect(exists).toBe(true);
  });

  it('retorna false quando username ainda nao possui lead', async () => {
    vi.mocked(discoveryRepository.findInstagramProfileByNormalizedUsername).mockResolvedValue(null as never);

    const exists = await leadDeduplicationService.existsByNormalizedUsername('tenant-1', 'closragency');
    expect(exists).toBe(false);
  });
});
