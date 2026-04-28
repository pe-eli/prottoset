import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const addMock = vi.fn();

  class FakeQueue {
    add = addMock;
  }

  return { addMock, FakeQueue };
});

vi.mock('bullmq', () => ({
  Queue: mocked.FakeQueue,
}));

vi.mock('../infrastructure/redis', () => ({
  getRedisClient: vi.fn(() => ({ mocked: true })),
}));

import {
  enqueueDiscoverySearchJob,
  enqueueInstagramExtractionJob,
  enqueueLeadNormalizationJob,
} from './queues';

describe('discovery queues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enfileira os jobs de discovery com jobId deterministico', async () => {
    await enqueueDiscoverySearchJob({ tenantId: 'tenant-1', searchId: 'search-1' });
    await enqueueInstagramExtractionJob({ tenantId: 'tenant-1', searchId: 'search-1', rawResultId: 'raw-1', profileUrl: 'https://instagram.com/foo' });
    await enqueueLeadNormalizationJob({
      tenantId: 'tenant-1',
      searchId: 'search-1',
      rawResultId: 'raw-1',
      originalQuery: 'social media',
      normalizedProfile: {
        username: 'foo',
        normalizedUsername: 'foo',
        fullName: 'Foo',
        biography: '',
        externalUrl: '',
        followers: null,
        profilePicUrl: '',
        profileUrl: 'https://instagram.com/foo',
        source: 'instagram_public_profile',
      },
    });

    expect(mocked.addMock).toHaveBeenCalledTimes(3);
    expect(mocked.addMock.mock.calls[0][2]).toEqual({ jobId: 'tenant-1:search-1' });
    expect(mocked.addMock.mock.calls[1][2]).toEqual({ jobId: 'tenant-1:raw-1' });
    expect(mocked.addMock.mock.calls[2][2]).toEqual({ jobId: 'tenant-1:raw-1' });
  });
});
