interface SerperSearchParams {
  niche: string;
  city: string;
  state?: string;
  keywords?: string;
  platform?: string;
  limit?: number;
}

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

interface SerperResponse {
  organic: SerperOrganicResult[];
}

interface ParsedLead {
  name: string;
  link: string;
  platform: string;
  snippet: string;
}

function buildQuery(params: SerperSearchParams): string {
  const parts: string[] = [];

  if (params.platform) {
    const platformDomains: Record<string, string> = {
      instagram: 'instagram.com',
      facebook: 'facebook.com',
      linkedin: 'linkedin.com',
      twitter: 'x.com',
    };
    const domain = platformDomains[params.platform.toLowerCase()] || params.platform;
    parts.push(`site:${domain}`);
  }

  parts.push(`"${params.niche}"`);
  parts.push(`"${params.city}"`);

  if (params.state) {
    parts.push(`"${params.state}"`);
  }

  if (params.keywords) {
    const kw = params.keywords.split(',').map((k) => k.trim()).filter(Boolean);
    kw.forEach((k) => parts.push(`"${k}"`));
  }

  return parts.join(' ');
}

function detectPlatform(link: string): string {
  if (link.includes('instagram.com')) return 'Instagram';
  if (link.includes('facebook.com')) return 'Facebook';
  if (link.includes('linkedin.com')) return 'LinkedIn';
  if (link.includes('x.com') || link.includes('twitter.com')) return 'Twitter';
  return 'Website';
}

function extractName(title: string, link: string): string {
  // Try to extract Instagram username
  const igMatch = link.match(/instagram\.com\/([^/?]+)/);
  if (igMatch && igMatch[1] !== 'p' && igMatch[1] !== 'explore') {
    return `@${igMatch[1]}`;
  }

  // Clean up title: remove common suffixes
  return title
    .replace(/\s*[-|·•]\s*Instagram.*$/i, '')
    .replace(/\s*[-|·•]\s*Facebook.*$/i, '')
    .replace(/\s*[-|·•]\s*LinkedIn.*$/i, '')
    .replace(/\(\@[^)]+\)/, '')
    .trim()
    || title;
}

function parseResults(results: SerperOrganicResult[]): ParsedLead[] {
  return results.map((r) => ({
    name: extractName(r.title, r.link),
    link: r.link,
    platform: detectPlatform(r.link),
    snippet: r.snippet || '',
  }));
}

export const serperService = {
  buildQuery,

  async search(params: SerperSearchParams): Promise<ParsedLead[]> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      throw new Error('SERPER_API_KEY is not configured');
    }

    const query = buildQuery(params);
    const total = params.limit || 10;
    const PAGE_SIZE = 20;
    const allResults: SerperOrganicResult[] = [];

    for (let offset = 0; offset < total; offset += PAGE_SIZE) {
      const num = Math.min(PAGE_SIZE, total - offset);

      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          num,
          ...(offset > 0 ? { page: Math.floor(offset / PAGE_SIZE) + 1 } : {}),
          gl: 'br',
          hl: 'pt-br',
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Serper API error (${response.status}): ${text}`);
      }

      const data = await response.json() as SerperResponse;
      const results = data.organic || [];
      allResults.push(...results);

      if (results.length < num) break;
    }

    return parseResults(allResults);
  },
};
