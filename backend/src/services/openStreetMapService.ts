import { logger } from '../utils/logger';

interface NominatimResult {
  osm_id: number;
  osm_type: string;
  display_name: string;
}

interface OverpassElement {
  tags?: { name?: string };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const MAX_BAIRROS = 8;

export const openStreetMapService = {
  /**
   * Busca bairros de uma cidade usando Nominatim + Overpass API.
   * Retorna até 8 bairros únicos.
   */
  async getNeighborhoods(city: string): Promise<string[]> {
    logger.info(`Buscando bairros de "${city}" via OpenStreetMap...`);

    // 1. Localizar cidade no Nominatim
    const cityName = await this.findCityName(city);
    if (!cityName) {
      logger.warn(`Cidade "${city}" não encontrada no Nominatim. Usando nome direto.`);
      return await this.queryOverpass(city);
    }

    // 2. Consultar bairros via Overpass
    return await this.queryOverpass(cityName);
  },

  async findCityName(city: string): Promise<string | null> {
    try {
      const params = new URLSearchParams({
        q: city,
        format: 'json',
        addressdetails: '1',
        limit: '1',
        countrycodes: 'br',
      });

      const response = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: {
          'User-Agent': 'Prottoset/1.0 (lead-generator)',
        },
      });

      if (!response.ok) return null;

      const data = (await response.json()) as NominatimResult[];
      if (data.length === 0) return null;

      // Extrair nome da cidade do display_name (primeiro segmento)
      const displayName = data[0].display_name;
      const name = displayName.split(',')[0].trim();
      logger.info(`Nominatim: cidade identificada como "${name}"`);
      return name;
    } catch (err: any) {
      logger.warn(`Erro Nominatim: ${err.message}`);
      return null;
    }
  },

  async queryOverpass(cityName: string): Promise<string[]> {
    const query = `
      [out:json][timeout:15];
      area["name"="${cityName}"]["boundary"="administrative"]->.searchArea;
      (
        node["place"="suburb"](area.searchArea);
        node["place"="neighbourhood"](area.searchArea);
      );
      out tags;
    `.trim();

    try {
      const response = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        const text = await response.text();
        logger.warn(`Overpass API error (${response.status}): ${text.slice(0, 200)}`);
        return [];
      }

      const data = (await response.json()) as OverpassResponse;
      const names = data.elements
        .map((el) => el.tags?.name)
        .filter((n): n is string => !!n);

      const unique = [...new Set(names)].slice(0, MAX_BAIRROS);
      logger.info(`Overpass: ${unique.length} bairros encontrados — ${unique.join(', ')}`);
      return unique;
    } catch (err: any) {
      logger.warn(`Erro Overpass: ${err.message}`);
      return [];
    }
  },
};
