import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { GoogleSearchCandidate } from '../types';
import { isRetryableHttpStatus, randomDelay } from '../discovery.utils';
import { structuredLogger } from '../../../observability/structured-logger';

const GOOGLE_SEARCH_URL = 'https://www.google.com/search';
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
];

function pickUserAgent(index: number): string {
  return USER_AGENTS[index % USER_AGENTS.length];
}

function parseGoogleRedirectUrl(rawHref: string): string {
  if (!rawHref) return '';
  if (rawHref.startsWith('/url?')) {
    const params = new URLSearchParams(rawHref.slice('/url?'.length));
    return params.get('q') || '';
  }
  return rawHref;
}

function toInstagramProfileUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (!host.endsWith('instagram.com')) return null;

  const path = parsed.pathname.replace(/^\/+|\/+$/g, '');
  if (!path) return null;

  const [firstSegment] = path.split('/');
  const disallowed = new Set(['p', 'reel', 'stories', 'explore', 'accounts', 'about', 'developer']);
  if (!firstSegment || disallowed.has(firstSegment.toLowerCase())) {
    return null;
  }

  return `https://www.instagram.com/${firstSegment.replace(/^@/, '')}`;
}

async function fetchGooglePage(searchQuery: string, start: number, userAgent: string): Promise<string> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axios.get<string>(GOOGLE_SEARCH_URL, {
        timeout: 15_000,
        params: {
          q: searchQuery,
          hl: 'pt-BR',
          num: 10,
          start,
          safe: 'active',
        },
        headers: {
          'User-Agent': userAgent,
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
      });
      return response.data;
    } catch (error) {
      lastError = error;
      const axiosError = error as AxiosError;
      const retryable = axiosError.code === 'ECONNABORTED' || isRetryableHttpStatus(axiosError.response?.status);
      if (!retryable || attempt === 3) {
        break;
      }

      const backoffMs = 1_000 * 2 ** (attempt - 1);
      await randomDelay(backoffMs, backoffMs + 1_200);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha ao consultar Google Search');
}

function parseGoogleHtml(html: string): GoogleSearchCandidate[] {
  const $ = cheerio.load(html);
  const results: GoogleSearchCandidate[] = [];

  // Try modern Google SERP structure (2024+): divs with data-sokoban-container or Gx5Zad class
  const modernSelectors = [
    'div[data-sokoban-container="true"]',
    'div.Gx5Zad',
    'div.g',  // fallback to legacy selector
  ];

  for (const selector of modernSelectors) {
    $(selector).each((_idx, element) => {
      const $el = $(element);
      
      // Find the link element - could be direct child or nested
      const anchor = $el.find('a[href*="/url?"]').first() || $el.find('a').first();
      if (!anchor.length) return;

      const href = parseGoogleRedirectUrl(anchor.attr('href') || '');
      if (!href) return;

      // Extract title from h3 tag
      const title = $el.find('h3').first().text().trim();
      
      // Extract snippet from common snippet classes
      let snippet = '';
      const snippetElement = $el.find('div.VwiC3b, span.aCOpRe, div.s, span.s').first();
      if (snippetElement.length) {
        snippet = snippetElement.text().trim();
      }

      const instagramUrl = toInstagramProfileUrl(href);

      // Only add if we have basic info
      if (title || instagramUrl) {
        results.push({
          title,
          snippet,
          url: href,
          instagramUrl,
        });
      }
    });

    // If we found results with this selector, use them
    if (results.length > 0) break;
  }

  return results;
}

export class GoogleSearchProvider {
  async searchInstagramCandidates(query: string, maxResults: number): Promise<GoogleSearchCandidate[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(maxResults || 20)));
    const pages = Math.max(1, Math.min(3, Math.ceil(safeLimit / 10)));
    const searchQueries = [
      `site:instagram.com \"${query}\"`,
      `site:instagram.com ${query}`,
    ];

    const merged = new Map<string, GoogleSearchCandidate>();

    for (let qIndex = 0; qIndex < searchQueries.length; qIndex++) {
      const searchQuery = searchQueries[qIndex];

      for (let page = 0; page < pages; page++) {
        const startedAt = Date.now();
        const start = page * 10;
        const userAgent = pickUserAgent(qIndex + page);
        const html = await fetchGooglePage(searchQuery, start, userAgent);
        const parsed = parseGoogleHtml(html);

        for (const item of parsed) {
          const key = item.url.toLowerCase();
          if (!merged.has(key)) {
            merged.set(key, item);
          }
        }

        structuredLogger.event('discovery_google_page_fetched', {
          provider: 'google',
          query,
          searchQuery,
          page,
          durationMs: Date.now() - startedAt,
          parsedResults: parsed.length,
        });

        await randomDelay(3_000, 8_000);
      }
    }

    return Array.from(merged.values()).slice(0, safeLimit);
  }
}
