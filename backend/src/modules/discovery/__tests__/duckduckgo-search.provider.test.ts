import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

const redisState = vi.hoisted(() => {
  return {
    ready: false,
    get: vi.fn(),
    set: vi.fn(),
  };
});

vi.mock('../../../infrastructure/redis', () => ({
  getRedisClient: vi.fn(() => ({ get: redisState.get, set: redisState.set })),
  isRedisReady: vi.fn(() => redisState.ready),
}));

vi.mock('../discovery.utils', async () => {
  const actual = await vi.importActual<typeof import('../discovery.utils')>('../discovery.utils');
  return {
    ...actual,
    randomDelay: vi.fn(async () => {}),
  };
});

import axios from 'axios';
import { DuckDuckGoSearchProvider } from '../providers/duckduckgo-search.provider';

const ddgHtml = `
<html>
  <body>
    <div class="result">
      <h2 class="result__title">
        <a class="result__a" href="https://www.instagram.com/closr.agency/">Closr Agency</a>
      </h2>
      <a class="result__snippet">Performance marketing</a>
    </div>
    <div class="result">
      <h2 class="result__title">
        <a class="result__a" href="https://www.instagram.com/reel/ABC123/">Reel</a>
      </h2>
      <a class="result__snippet">Nao deve entrar</a>
    </div>
  </body>
</html>
`;

describe('DuckDuckGoSearchProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisState.ready = false;
    redisState.get.mockReset();
    redisState.set.mockReset();
    redisState.get.mockResolvedValue(null);
    redisState.set.mockResolvedValue('OK');
  });

  it('extrai candidatos do duckduckgo e filtra apenas perfis instagram validos', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: ddgHtml } as never);

    const provider = new DuckDuckGoSearchProvider(1);
    const results = await provider.searchInstagramCandidates('gestor de trafego americana', 5);

    expect(results).toHaveLength(1);
    expect(results[0].instagramUrl).toBe('https://www.instagram.com/closr.agency');
    expect(results.some((item) => item.url.includes('/reel/'))).toBe(false);
  });

  it('faz retry com backoff quando recebe status 429', async () => {
    vi.mocked(axios.get)
      .mockRejectedValueOnce({ response: { status: 429 }, code: 'ERR_BAD_REQUEST' } as never)
      .mockResolvedValue({ data: ddgHtml } as never);

    const provider = new DuckDuckGoSearchProvider(1);
    const results = await provider.searchInstagramCandidates('social media', 5);

    expect(results.length).toBeGreaterThan(0);
    expect(axios.get).toHaveBeenCalledTimes(4);
  });

  it('reaproveita cache em memoria quando redis nao esta pronto', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: ddgHtml } as never);

    const provider = new DuckDuckGoSearchProvider(1);
    const first = await provider.searchInstagramCandidates('marketing americana', 5);
    const second = await provider.searchInstagramCandidates('marketing americana', 5);

    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBeGreaterThan(0);
    expect(axios.get).toHaveBeenCalledTimes(3);
  });

  it('usa cache redis quando disponivel', async () => {
    redisState.ready = true;
    redisState.get.mockResolvedValue(null);
    vi.mocked(axios.get).mockResolvedValue({ data: ddgHtml } as never);

    const provider = new DuckDuckGoSearchProvider(1);
    await provider.searchInstagramCandidates('gestor de trafego', 5);

    expect(redisState.set).toHaveBeenCalledTimes(1);
    expect(redisState.set.mock.calls[0]?.[0]).toContain('discovery:search:gestor de trafego');
    expect(redisState.set.mock.calls[0]?.[3]).toBe(6 * 60 * 60);
  });

  it('limita concorrencia entre 1 e 2 requests simultaneas', async () => {
    let active = 0;
    let maxActive = 0;

    vi.mocked(axios.get).mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { data: ddgHtml } as never;
    });

    const provider = new DuckDuckGoSearchProvider(2);
    await provider.searchInstagramCandidates('social media americana', 30);

    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
