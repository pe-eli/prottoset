import axios, { AxiosError } from 'axios';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getRedisClient, isRedisReady } from '../../../infrastructure/redis';
import { structuredLogger } from '../../../observability/structured-logger';
import { DISCOVERY_SEARCH_CACHE_TTL_SECONDS } from '../discovery.constants';
import { isRetryableHttpStatus, randomDelay } from '../discovery.utils';
import { DiscoverySearchCandidate, DiscoverySearchProvider } from '../types';
import { parseDuckDuckGoHtml } from './duckduckgo-html.parser';
import { extractInstagramProfileUrl } from './instagram-url.extractor';

const DUCKDUCKGO_HTML_URL = 'https://html.duckduckgo.com/html/';
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0',
];

interface SearchPageResult {
  query: string;
  page: number;
  parsed: DiscoverySearchCandidate[];
}

interface MemoryCacheEntry {
  value: DiscoverySearchCandidate[];
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryCacheEntry>();

function pickUserAgent(index: number): string {
  return USER_AGENTS[index % USER_AGENTS.length];
}

function normalizeQuery(raw: string): string {
  return String(raw || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildSearchQueries(query: string): string[] {
  const base = String(query || '').replace(/["“”]/g, ' ').trim().replace(/\s+/g, ' ');
  if (!base) return ['site:instagram.com'];

  return [
    `site:instagram.com ${base}`,
    `${base} instagram`,
    `site:instagram.com "${base}"`,
  ];
}

function cacheKeyForQuery(query: string): string {
  return `discovery:search:${normalizeQuery(query)}`;
}

function detectBlockedResponse(html: string): string | null {
  const content = String(html || '').trim();
  if (!content) return 'empty_response';

  const lowered = content.toLowerCase();
  if (lowered.includes('captcha')) return 'captcha';
  if (!lowered.includes('<html') && !lowered.includes('<body')) return 'malformed_html';

  return null;
}

async function saveDebugHtml(html: string): Promise<void> {
  const debugDir = path.resolve(process.cwd(), 'debug');
  const debugFile = path.join(debugDir, 'duckduckgo-response.html');
  await mkdir(debugDir, { recursive: true });
  await writeFile(debugFile, html, 'utf-8');
}

function dedupeByUrl(candidates: DiscoverySearchCandidate[]): DiscoverySearchCandidate[] {
  const deduped = new Map<string, DiscoverySearchCandidate>();

  for (const candidate of candidates) {
    const key = candidate.url.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, candidate);
    }
  }

  return Array.from(deduped.values());
}

async function fetchDuckDuckGoPage(searchQuery: string, page: number, userAgent: string): Promise<string> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axios.get<string>(DUCKDUCKGO_HTML_URL, {
        timeout: 15_000,
        params: {
          q: searchQuery,
          s: page * 30,
          kl: 'br-pt',
        },
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });

      return response.data;
    } catch (error) {
      lastError = error;
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const retryable = axiosError.code === 'ECONNABORTED' || isRetryableHttpStatus(status);

      structuredLogger.event('request_failed', {
        provider: 'duckduckgo',
        query: searchQuery,
        page,
        attempt,
        status,
        code: axiosError.code,
        retryable,
      });

      if (!retryable || attempt === 3) {
        break;
      }

      const backoffMs = 1_000 * 2 ** (attempt - 1);
      await randomDelay(backoffMs, backoffMs + 1_200);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha ao consultar DuckDuckGo HTML');
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  if (tasks.length === 0) return [];

  const safeConcurrency = Math.max(1, Math.min(2, Math.floor(concurrency || 1)));
  const results: T[] = new Array(tasks.length);
  let nextTask = 0;

  async function worker(): Promise<void> {
    while (nextTask < tasks.length) {
      const current = nextTask;
      nextTask += 1;
      results[current] = await tasks[current]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(safeConcurrency, tasks.length) }, () => worker()));
  return results;
}

export class DuckDuckGoSearchProvider implements DiscoverySearchProvider {
  private readonly requestConcurrency: number;

  constructor(requestConcurrency = Number(process.env.DISCOVERY_SEARCH_CONCURRENCY || 1)) {
    this.requestConcurrency = Math.max(1, Math.min(2, Math.floor(requestConcurrency || 1)));
  }

  private readMemoryCache(query: string): DiscoverySearchCandidate[] | null {
    const key = cacheKeyForQuery(query);
    const entry = memoryCache.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      memoryCache.delete(key);
      return null;
    }

    return entry.value;
  }

  private writeMemoryCache(query: string, value: DiscoverySearchCandidate[]): void {
    memoryCache.set(cacheKeyForQuery(query), {
      value,
      expiresAt: Date.now() + DISCOVERY_SEARCH_CACHE_TTL_SECONDS * 1000,
    });
  }

  private async readCache(query: string): Promise<DiscoverySearchCandidate[] | null> {
    const redis = getRedisClient();
    const key = cacheKeyForQuery(query);

    if (redis && isRedisReady()) {
      const payload = await redis.get(key);
      if (!payload) return null;
      try {
        return JSON.parse(payload) as DiscoverySearchCandidate[];
      } catch {
        return null;
      }
    }

    return this.readMemoryCache(query);
  }

  private async writeCache(query: string, value: DiscoverySearchCandidate[]): Promise<void> {
    const redis = getRedisClient();
    const key = cacheKeyForQuery(query);

    if (redis && isRedisReady()) {
      await redis.set(key, JSON.stringify(value), 'EX', DISCOVERY_SEARCH_CACHE_TTL_SECONDS);
      return;
    }

    this.writeMemoryCache(query, value);
  }

  private async runQueryPage(searchQuery: string, page: number): Promise<SearchPageResult> {
    const userAgent = pickUserAgent(page + searchQuery.length);
    const html = await fetchDuckDuckGoPage(searchQuery, page, userAgent);

    const blockedReason = detectBlockedResponse(html);
    if (blockedReason) {
      structuredLogger.event('blocked_detected', {
        provider: 'duckduckgo',
        reason: blockedReason,
        query: searchQuery,
        page,
      });
      await saveDebugHtml(html);
      return { query: searchQuery, page, parsed: [] };
    }

    const parsed = parseDuckDuckGoHtml(html)
      .map((result) => {
        const extracted = extractInstagramProfileUrl(result.url);
        return {
          title: result.title,
          snippet: result.snippet,
          url: result.url,
          instagramUrl: extracted?.profileUrl || null,
        } satisfies DiscoverySearchCandidate;
      })
      .filter((item) => Boolean(item.instagramUrl));

    structuredLogger.event('results_parsed', {
      provider: 'duckduckgo',
      query: searchQuery,
      page,
      parsedResults: parsed.length,
    });

    if (parsed.length === 0) {
      await saveDebugHtml(html);
    }

    await randomDelay(2_000, 6_000);

    return {
      query: searchQuery,
      page,
      parsed,
    };
  }

  async searchInstagramCandidates(query: string, maxResults: number): Promise<DiscoverySearchCandidate[]> {
    const startedAt = Date.now();
    const safeLimit = Math.max(1, Math.min(100, Math.floor(maxResults || 20)));
    const pages = Math.max(1, Math.min(3, Math.ceil(safeLimit / 10)));

    structuredLogger.event('search_started', {
      provider: 'duckduckgo',
      query,
      maxResults: safeLimit,
      pages,
      concurrency: this.requestConcurrency,
    });

    const cached = await this.readCache(query);
    if (cached && cached.length > 0) {
      const cachedSliced = cached.slice(0, safeLimit);
      structuredLogger.event('instagram_urls_found', {
        provider: 'duckduckgo',
        query,
        count: cachedSliced.length,
        cacheHit: true,
      });
      structuredLogger.event('search_completed', {
        provider: 'duckduckgo',
        query,
        durationMs: Date.now() - startedAt,
        totalResults: cachedSliced.length,
        cacheHit: true,
      });
      return cachedSliced;
    }

    const searchQueries = buildSearchQueries(query);
    const tasks: Array<() => Promise<SearchPageResult>> = [];

    for (const searchQuery of searchQueries) {
      for (let page = 0; page < pages; page++) {
        tasks.push(() => this.runQueryPage(searchQuery, page));
      }
    }

    const pageResults = await runWithConcurrency(tasks, this.requestConcurrency);
    const merged = dedupeByUrl(pageResults.flatMap((result) => result.parsed));
    const sliced = merged.slice(0, safeLimit);

    structuredLogger.event('instagram_urls_found', {
      provider: 'duckduckgo',
      query,
      count: sliced.length,
      cacheHit: false,
    });

    await this.writeCache(query, merged);

    structuredLogger.event('search_completed', {
      provider: 'duckduckgo',
      query,
      durationMs: Date.now() - startedAt,
      totalResults: sliced.length,
      cacheHit: false,
    });

    return sliced;
  }
}
