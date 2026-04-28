import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { getRedisClient, isRedisReady } from '../../../infrastructure/redis';
import { INSTAGRAM_PROFILE_CACHE_TTL_SECONDS } from '../discovery.constants';
import { isRetryableHttpStatus, normalizeUrl, randomDelay } from '../discovery.utils';
import { InstagramProfileExtracted } from '../types';

const INSTAGRAM_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

interface MemoryCacheEntry {
  value: InstagramProfileExtracted;
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryCacheEntry>();

function normalizeUsername(raw: string): string {
  return String(raw || '').trim().replace(/^@/, '').toLowerCase();
}

function profileUrlForUsername(username: string): string {
  return `https://www.instagram.com/${username}/`;
}

function parseProfileUsername(profileUrl: string): string {
  try {
    const parsed = new URL(profileUrl);
    const [segment] = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/');
    return normalizeUsername(segment || '');
  } catch {
    return '';
  }
}

function decodeEscapedString(value: string): string {
  try {
    return JSON.parse(`\"${value.replace(/\"/g, '\\\"')}\"`);
  } catch {
    return value;
  }
}

function parseFollowers(description: string): number | null {
  const match = description.match(/([\d.,]+)\s+Followers/i);
  if (!match) return null;

  const normalized = match[1].replace(/[^\d]/g, '');
  const numeric = Number.parseInt(normalized, 10);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function findFromScripts(html: string, regex: RegExp): string {
  const match = html.match(regex);
  if (!match?.[1]) return '';
  return decodeEscapedString(match[1]);
}

function parseInstagramHtml(html: string, username: string, profileUrl: string): InstagramProfileExtracted {
  const $ = cheerio.load(html);

  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const ogDescription = $('meta[property="og:description"]').attr('content') || '';
  const ogImage = $('meta[property="og:image"]').attr('content') || '';

  const fullNameFromTitle = ogTitle.replace(/\(@[^)]+\).*/, '').trim();

  const biographyFromScript = findFromScripts(html, /\"biography\":\"([^\"]*)\"/);
  const externalUrlFromScript = findFromScripts(html, /\"external_url\":\"([^\"]*)\"/);
  const profilePicFromScript = findFromScripts(html, /\"profile_pic_url_hd\":\"([^\"]*)\"/);

  return {
    username,
    fullName: fullNameFromTitle || username,
    biography: biographyFromScript,
    externalUrl: normalizeUrl(externalUrlFromScript),
    followers: parseFollowers(ogDescription),
    profilePicUrl: normalizeUrl(profilePicFromScript || ogImage),
    profileUrl,
    source: 'instagram_public_profile',
  };
}

async function fetchInstagramHtml(profileUrl: string): Promise<string> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axios.get<string>(profileUrl, {
        timeout: 15_000,
        headers: {
          'User-Agent': INSTAGRAM_UA,
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

      const backoffMs = 1_500 * 2 ** (attempt - 1);
      await randomDelay(backoffMs, backoffMs + 1_200);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha ao extrair perfil do Instagram');
}

export class InstagramExtractor {
  private cacheKey(username: string): string {
    return `instagram:profile:${normalizeUsername(username)}`;
  }

  private readMemoryCache(username: string): InstagramProfileExtracted | null {
    const key = this.cacheKey(username);
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      memoryCache.delete(key);
      return null;
    }
    return entry.value;
  }

  private writeMemoryCache(username: string, value: InstagramProfileExtracted): void {
    const key = this.cacheKey(username);
    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + INSTAGRAM_PROFILE_CACHE_TTL_SECONDS * 1000,
    });
  }

  private async readCache(username: string): Promise<InstagramProfileExtracted | null> {
    const normalized = normalizeUsername(username);
    if (!normalized) return null;

    const redis = getRedisClient();
    if (redis && isRedisReady()) {
      const payload = await redis.get(this.cacheKey(normalized));
      if (!payload) return null;
      try {
        return JSON.parse(payload) as InstagramProfileExtracted;
      } catch {
        return null;
      }
    }

    return this.readMemoryCache(normalized);
  }

  private async writeCache(username: string, profile: InstagramProfileExtracted): Promise<void> {
    const normalized = normalizeUsername(username);
    if (!normalized) return;

    const redis = getRedisClient();
    if (redis && isRedisReady()) {
      await redis.set(this.cacheKey(normalized), JSON.stringify(profile), 'EX', INSTAGRAM_PROFILE_CACHE_TTL_SECONDS);
      return;
    }

    this.writeMemoryCache(normalized, profile);
  }

  async extract(profileUrl: string): Promise<InstagramProfileExtracted> {
    const normalizedUrl = normalizeUrl(profileUrl);
    const username = parseProfileUsername(normalizedUrl);
    if (!username) {
      throw new Error('URL de perfil do Instagram inválida');
    }

    const cached = await this.readCache(username);
    if (cached) {
      return cached;
    }

    const canonicalProfileUrl = profileUrlForUsername(username);
    const html = await fetchInstagramHtml(canonicalProfileUrl);
    const profile = parseInstagramHtml(html, username, canonicalProfileUrl);
    await this.writeCache(username, profile);
    return profile;
  }
}
