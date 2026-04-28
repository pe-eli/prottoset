import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../discovery.utils', async () => {
  const actual = await vi.importActual<typeof import('../discovery.utils')>('../discovery.utils');
  return {
    ...actual,
    randomDelay: vi.fn(async () => {}),
  };
});

import axios from 'axios';
import { GoogleSearchProvider } from '../providers/google-search.provider';

const googleHtml = `
<html>
  <body>
    <div class="g">
      <a href="/url?q=https://www.instagram.com/closr.agency/&sa=U"><h3>Closr Agency</h3></a>
      <div class="VwiC3b">Performance marketing</div>
    </div>
    <div class="g">
      <a href="/url?q=https://www.instagram.com/reel/ABC123/&sa=U"><h3>Reel</h3></a>
      <div class="VwiC3b">Nao deve entrar</div>
    </div>
  </body>
</html>
`;

describe('GoogleSearchProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extrai candidatos do google e filtra urls de perfil instagram', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: googleHtml } as never);

    const provider = new GoogleSearchProvider();
    const results = await provider.searchInstagramCandidates('social media em belo horizonte', 5);

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((item) => item.instagramUrl === 'https://www.instagram.com/closr.agency')).toBe(true);
    expect(results.some((item) => item.instagramUrl?.includes('/reel/'))).toBe(false);
  });
});
