import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../../infrastructure/redis', () => ({
  getRedisClient: vi.fn(() => null),
  isRedisReady: vi.fn(() => false),
}));

import axios from 'axios';
import { InstagramExtractor } from '../extractors/instagram.extractor';

const instagramHtml = `
<html>
  <head>
    <meta property="og:title" content="Closr Agency (@closr.agency) • Instagram photos and videos" />
    <meta property="og:description" content="2,345 Followers, 120 Following, 88 Posts - Closr Agency" />
    <meta property="og:image" content="https://cdn.example.com/avatar.jpg" />
  </head>
  <body>
    <script>
      window.__INITIAL_STATE__ = {\"biography\":\"Leads para agências\",\"external_url\":\"https:\\/\\/closr.dev\",\"profile_pic_url_hd\":\"https:\\/\\/cdn.example.com\\/hd.jpg\"};
    </script>
  </body>
</html>
`;

describe('InstagramExtractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extrai metadados publicos e reaproveita cache em memoria', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: instagramHtml } as never);

    const extractor = new InstagramExtractor();
    const first = await extractor.extract('https://www.instagram.com/closr.agency/');
    const second = await extractor.extract('https://www.instagram.com/closr.agency/');

    expect(first.username).toBe('closr.agency');
    expect(first.fullName).toBe('Closr Agency');
    expect(first.followers).toBe(2345);
    expect(first.externalUrl).toBe('https://closr.dev');
    expect(second.username).toBe('closr.agency');
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});
