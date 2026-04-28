export const DISCOVERY_PROVIDER_GOOGLE = 'google';

export const DISCOVERY_QUEUE_NAMES = {
  search: 'discovery-search-queue',
  instagramExtraction: 'instagram-extraction-queue',
  leadNormalization: 'lead-normalization-queue',
} as const;

export const DISCOVERY_PROGRESS_LABELS = {
  queued: 'Encontrando empresas...',
  running: 'Buscando perfis...',
  normalizing: 'Analisando leads...',
} as const;

export const INSTAGRAM_PROFILE_CACHE_TTL_SECONDS = 24 * 60 * 60;
