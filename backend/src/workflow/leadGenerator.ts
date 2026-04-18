import { v4 as uuid } from 'uuid';
import { openStreetMapService } from '../services/openStreetMapService';
import { googleMapsService, MapsPlace } from '../services/googleMapsService';
import { scraperService } from '../services/scraperService';
import { emailExtractor } from '../services/emailExtractor';
import { leadScoringService } from '../services/leadScoringService';
import { logger } from '../utils/logger';
import { pMap, sleep } from '../utils/rateLimiter';
import type { Lead, LeadSearchParams, LeadMetrics } from '../types/leads.types';

const DELAY_BETWEEN_SERPER_MS = 1_000;
const DELAY_BETWEEN_SCRAPES_MS = 500;
const SCRAPE_CONCURRENCY = 5;

export interface GenerateLeadsResult {
  leads: Lead[];
  metrics: LeadMetrics;
}

/**
 * Workflow completo de geração de leads:
 * 1. Buscar bairros da cidade via OpenStreetMap
 * 2. Para cada bairro, buscar empresas no Google Maps (Serper)
 * 3. Deduplica por nome+endereço
 * 4. Para places com website, scrape HTML e extrai emails
 * 5. Calcular prioridade (sem site + com tel = HIGH)
 * 6. Retorna leads[] + métricas
 */
export async function generateLeads(params: LeadSearchParams): Promise<GenerateLeadsResult> {
  const { searchTerm, city, maxResults } = params;
  const targetResults = Number.isFinite(maxResults) && (maxResults ?? 0) > 0
    ? Math.max(1, Math.floor(maxResults as number))
    : 20;
  logger.info(`Iniciando workflow: "${searchTerm}" em "${city}"`);

  // --- PASSO 1: Bairros via OpenStreetMap ---
  logger.info('Buscando bairros...');
  let neighborhoods: string[];
  try {
    neighborhoods = await openStreetMapService.getNeighborhoods(city);
  } catch (err: any) {
    logger.warn(`Erro ao buscar bairros: ${err.message}`);
    neighborhoods = [];
  }

  if (neighborhoods.length === 0) {
    neighborhoods = [city];
    logger.info(`Nenhum bairro encontrado, usando cidade: "${city}"`);
  }

  // --- PASSO 2+3: Google Maps search por bairro + deduplica ---
  logger.info('Executando busca Google Maps...');
  const allPlaces: (MapsPlace & { neighborhood: string })[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < neighborhoods.length; i++) {
    if (allPlaces.length >= targetResults) {
      logger.info(`Limite de resultados atingido (${targetResults}). Interrompendo busca por bairros.`);
      break;
    }

    const neighborhood = neighborhoods[i];
    const query = `${searchTerm} ${neighborhood}`;
    const remaining = targetResults - allPlaces.length;

    try {
      const places = await googleMapsService.searchPlaces(query, city, remaining);

      for (const place of places) {
        // Deduplica por nome normalizado (evita duplicar empresas sem website)
        const placeName = typeof place.name === 'string' ? place.name : '';
        const placeAddress = typeof place.address === 'string' ? place.address : '';
        const key = `${placeName.toLowerCase().trim()}|${placeAddress.toLowerCase().trim()}`;
        if (!seen.has(key)) {
          seen.add(key);
          allPlaces.push({ ...place, neighborhood });

          if (allPlaces.length >= targetResults) {
            break;
          }
        }
      }
    } catch (err: any) {
      logger.warn(`Erro buscando "${query}": ${err.message}`);
    }

    // Rate limiting entre queries Serper
    if (i < neighborhoods.length - 1 && allPlaces.length < targetResults) {
      await sleep(DELAY_BETWEEN_SERPER_MS);
    }
  }

  logger.info(`Total de places únicos: ${allPlaces.length}`);

  if (allPlaces.length === 0) {
    logger.info('Nenhum resultado encontrado.');
    return { leads: [], metrics: { totalLeads: 0, leadsComWebsite: 0, leadsSemWebsite: 0, leadsAltaPrioridade: 0 } };
  }

  // --- PASSO 4+5+6: Criar leads, enriquecer com scraping se houver site, scoring ---
  logger.info('Scraping websites e extraindo emails...');
  const now = new Date().toISOString();

  const leads = await pMap(
    allPlaces,
    async (place, i) => {
      const hasWebsite = !!place.website;
      let websiteFetchError = false;
      let emails: string[] = [];

      // Enriquecimento: somente se houver website
      if (hasWebsite) {
        logger.info(`[${i + 1}/${allPlaces.length}] Scraping: ${place.website}`);
        const html = await scraperService.fetchHTML(place.website);
        if (html) {
          emails = emailExtractor.extract(html, 2);
          if (emails.length > 0) {
            logger.info(`Emails encontrados: ${emails.length}`);
          }
        } else {
          websiteFetchError = true;
          logger.warn(`Website possivelmente fora do ar ou inacessível: ${place.website}`);
        }

        // Delay entre scrapes
        await sleep(DELAY_BETWEEN_SCRAPES_MS);
      }

      const hasPhone = !!place.phone;
      const priority = leadScoringService.calculatePriority(hasWebsite, hasPhone);

      const lead: Lead = {
        id: uuid(),
        name: place.name,
        phone: place.phone,
        website: place.website,
        websiteFetchError,
        email1: emails[0] || '',
        email2: emails[1] || '',
        city,
        neighborhood: place.neighborhood,
        address: place.address,
        hasWebsite,
        rating: place.rating,
        niche: searchTerm,
        priority,
        status: 'new',
        createdAt: now,
      };

      return lead;
    },
    SCRAPE_CONCURRENCY,
  );

  // --- PASSO 7: Métricas ---
  const metrics: LeadMetrics = {
    totalLeads: leads.length,
    leadsComWebsite: leads.filter((l) => l.hasWebsite).length,
    leadsSemWebsite: leads.filter((l) => !l.hasWebsite).length,
    leadsAltaPrioridade: leads.filter((l) => l.priority === 'HIGH').length,
  };

  logger.info(`Workflow completo: ${metrics.totalLeads} leads (${metrics.leadsComWebsite} com site, ${metrics.leadsSemWebsite} sem site, ${metrics.leadsAltaPrioridade} alta prioridade)`);

  return { leads, metrics };
}
