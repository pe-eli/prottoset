import { metricsService } from '../../observability/metrics.service';
import { structuredLogger } from '../../observability/structured-logger';
import {
  enqueueInstagramExtractionJob,
  enqueueLeadNormalizationJob,
  InstagramExtractionJobPayload,
  LeadNormalizationJobPayload,
} from '../../jobs/queues';
import { DISCOVERY_PROVIDER_GOOGLE } from './discovery.constants';
import { InstagramExtractor } from './extractors/instagram.extractor';
import { leadDeduplicationService } from './dedup/lead-deduplication.service';
import { leadNormalizer } from './normalization/lead-normalizer';
import { GoogleSearchProvider } from './providers/google-search.provider';
import { discoveryRepository } from './repositories/discovery.repository';

export interface DiscoverySearchJobPayload {
  tenantId: string;
  searchId: string;
}

export class DiscoveryEngine {
  private readonly googleProvider = new GoogleSearchProvider();
  private readonly instagramExtractor = new InstagramExtractor();

  async processSearchJob(payload: DiscoverySearchJobPayload): Promise<void> {
    const startedAt = Date.now();
    try {
      const search = await discoveryRepository.getSearchById(payload.tenantId, payload.searchId);
      if (!search) return;

      await discoveryRepository.markSearchRunning(payload.tenantId, payload.searchId);

      const candidates = await this.googleProvider.searchInstagramCandidates(search.query, search.requestedMaxResults);
      const savedRaw = await discoveryRepository.saveRawResults(
        payload.tenantId,
        payload.searchId,
        DISCOVERY_PROVIDER_GOOGLE,
        candidates,
      );

      await discoveryRepository.incrementSearchCounters(payload.tenantId, payload.searchId, {
        discoveredUrls: savedRaw.length,
      });

      let extractionJobs = 0;
      for (const rawResult of savedRaw) {
        if (!rawResult.instagramUrl) {
          await discoveryRepository.setRawResultStatus(payload.tenantId, rawResult.id, 'failed', 'resultado sem perfil do Instagram');
          continue;
        }

        const jobPayload: InstagramExtractionJobPayload = {
          tenantId: payload.tenantId,
          searchId: payload.searchId,
          rawResultId: rawResult.id,
          profileUrl: rawResult.instagramUrl,
        };

        await enqueueInstagramExtractionJob(jobPayload);
        extractionJobs += 1;
      }

      await discoveryRepository.markSearchCompletedIfFinished(payload.tenantId, payload.searchId);

      metricsService.increment({
        name: 'discovery.search_jobs.processed',
        labels: { provider: 'google', extractionJobs },
      });
      metricsService.observeDuration({
        name: 'discovery.search_jobs.duration_ms',
        startedAt,
        labels: { provider: 'google' },
      });

      structuredLogger.event('discovery_search_job_completed', {
        tenantId: payload.tenantId,
        searchId: payload.searchId,
        candidates: candidates.length,
        rawSaved: savedRaw.length,
        extractionJobs,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'falha no processamento da busca discovery';
      await discoveryRepository.markSearchFailed(payload.tenantId, payload.searchId, message);
      throw error;
    }
  }

  async processInstagramExtractionJob(payload: InstagramExtractionJobPayload): Promise<void> {
    const startedAt = Date.now();
    try {
      const raw = await discoveryRepository.getRawResultById(payload.tenantId, payload.rawResultId);
      if (!raw) return;

      await discoveryRepository.setRawResultStatus(payload.tenantId, payload.rawResultId, 'extracting');

      const extracted = await this.instagramExtractor.extract(payload.profileUrl);
      const normalized = leadNormalizer.fromInstagramProfile(extracted);

      const normalizedJobPayload: LeadNormalizationJobPayload = {
        tenantId: payload.tenantId,
        searchId: payload.searchId,
        rawResultId: payload.rawResultId,
        normalizedProfile: normalized,
        originalQuery: '',
      };

      await enqueueLeadNormalizationJob(normalizedJobPayload);
      await discoveryRepository.setRawResultStatus(payload.tenantId, payload.rawResultId, 'extracted');
      await discoveryRepository.incrementSearchCounters(payload.tenantId, payload.searchId, {
        extractedProfiles: 1,
      });

      metricsService.increment({ name: 'discovery.instagram_extraction.success' });
      metricsService.observeDuration({
        name: 'discovery.instagram_extraction.duration_ms',
        startedAt,
        labels: { source: 'instagram_public_profile' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'falha ao extrair perfil do instagram';
      await discoveryRepository.setRawResultStatus(payload.tenantId, payload.rawResultId, 'failed', message);
      await discoveryRepository.markSearchCompletedIfFinished(payload.tenantId, payload.searchId);
      throw error;
    }
  }

  async processLeadNormalizationJob(payload: LeadNormalizationJobPayload): Promise<void> {
    const startedAt = Date.now();
    try {
      await discoveryRepository.setRawResultStatus(payload.tenantId, payload.rawResultId, 'normalizing');

      const isDuplicate = await leadDeduplicationService.existsByNormalizedUsername(
        payload.tenantId,
        payload.normalizedProfile.normalizedUsername,
      );

      const profile = await discoveryRepository.upsertInstagramProfile(
        payload.tenantId,
        payload.searchId,
        payload.normalizedProfile,
      );

      if (isDuplicate && profile.leadId) {
        await discoveryRepository.incrementSearchCounters(payload.tenantId, payload.searchId, { duplicates: 1 });
        await discoveryRepository.setRawResultStatus(payload.tenantId, payload.rawResultId, 'deduplicated');
        await discoveryRepository.markSearchCompletedIfFinished(payload.tenantId, payload.searchId);
        return;
      }

      const search = await discoveryRepository.getSearchById(payload.tenantId, payload.searchId);
      const leadCreation = await discoveryRepository.createLeadFromInstagramProfile(
        payload.tenantId,
        search?.query || payload.normalizedProfile.username,
        profile.id,
        payload.normalizedProfile,
      );

      if (leadCreation.duplicate) {
        await discoveryRepository.incrementSearchCounters(payload.tenantId, payload.searchId, { duplicates: 1 });
        await discoveryRepository.setRawResultStatus(payload.tenantId, payload.rawResultId, 'deduplicated');
      } else {
        await discoveryRepository.incrementSearchCounters(payload.tenantId, payload.searchId, { normalizedLeads: 1 });
        await discoveryRepository.setRawResultStatus(payload.tenantId, payload.rawResultId, 'normalized');
      }

      await discoveryRepository.markSearchCompletedIfFinished(payload.tenantId, payload.searchId);

      metricsService.increment({ name: 'discovery.normalization.processed' });
      metricsService.observeDuration({
        name: 'discovery.normalization.duration_ms',
        startedAt,
        labels: { duplicate: leadCreation.duplicate },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'falha ao normalizar lead';
      await discoveryRepository.setRawResultStatus(payload.tenantId, payload.rawResultId, 'failed', message);
      await discoveryRepository.markSearchCompletedIfFinished(payload.tenantId, payload.searchId);
      throw error;
    }
  }
}

export const discoveryEngine = new DiscoveryEngine();
