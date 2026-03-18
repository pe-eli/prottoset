import { logger } from '../utils/logger';

export interface MapsPlace {
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
}

interface SerperMapsResult {
  title: string;
  address: string;
  phoneNumber?: string;
  website?: string;
  rating?: number;
}

interface SerperMapsResponse {
  places: SerperMapsResult[];
}

const BLOCKED_DOMAINS = [
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'tiktok.com',
  'wa.me',
  'api.whatsapp.com',
  'google.com',
  'maps.google.com',
];

function isBlockedWebsite(url: string): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export const googleMapsService = {
  /**
   * Busca no Serper Maps API.
   * Retorna TODOS os places, inclusive sem website.
   * Apenas descarta websites de redes sociais.
   */
  async searchPlaces(query: string, city: string): Promise<MapsPlace[]> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) throw new Error('SERPER_API_KEY não configurado no .env');

    const fullQuery = `${query} ${city}`;
    logger.info(`Google Maps: buscando "${fullQuery}"`);

    const response = await fetch('https://google.serper.dev/maps', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: fullQuery,
        hl: 'pt-br',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Serper Maps API error (${response.status}): ${text}`);
    }

    const data = (await response.json()) as SerperMapsResponse;
    const places = data.places || [];

    const mapped: MapsPlace[] = places.map((p) => {
      const rawWebsite = p.website || '';
      const website = isBlockedWebsite(rawWebsite) ? '' : rawWebsite;

      return {
        name: p.title,
        address: p.address || '',
        phone: p.phoneNumber || '',
        website,
        rating: p.rating || 0,
      };
    });

    const withSite = mapped.filter((p) => p.website).length;
    const withoutSite = mapped.length - withSite;
    logger.info(`Google Maps: ${mapped.length} resultados (${withSite} com site, ${withoutSite} sem site)`);
    return mapped;
  },
};
