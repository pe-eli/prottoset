import { v4 as uuid } from 'uuid';
import { tenantQuery, tenantTransaction } from '../../../db/pool';
import { DiscoverySearchRecord, DiscoverySearchStatus, GoogleSearchCandidate, NormalizedLeadInput } from '../types';

interface DiscoverySearchRow {
  id: string;
  tenant_id: string;
  query: string;
  status: DiscoverySearchStatus;
  provider: string;
  requested_max_results: number;
  discovered_urls: number;
  extracted_profiles: number;
  normalized_leads: number;
  duplicates: number;
  error_message: string | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  updated_at: Date;
}

interface RawDiscoveryResultRow {
  id: string;
  search_id: string;
  tenant_id: string;
  provider: string;
  title: string;
  snippet: string;
  url: string;
  instagram_url: string | null;
  status: string;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

interface InstagramProfileRow {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  search_id: string | null;
  username: string;
  normalized_username: string;
  full_name: string;
  biography: string;
  external_url: string;
  followers: number | null;
  profile_pic_url: string;
  profile_url: string;
  source: string;
  created_at: Date;
  updated_at: Date;
}

interface LeadRow {
  id: string;
  name: string;
  phone: string;
  website: string;
  website_fetch_error: boolean;
  email1: string;
  email2: string;
  city: string;
  neighborhood: string;
  address: string;
  has_website: boolean;
  rating: string;
  niche: string;
  priority: string;
  status: string;
  created_at: Date;
}

function toDiscoverySearch(row: DiscoverySearchRow): DiscoverySearchRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    query: row.query,
    status: row.status,
    provider: row.provider,
    requestedMaxResults: row.requested_max_results,
    discoveredUrls: row.discovered_urls,
    extractedProfiles: row.extracted_profiles,
    normalizedLeads: row.normalized_leads,
    duplicates: row.duplicates,
    errorMessage: row.error_message,
    createdAt: row.created_at.toISOString(),
    startedAt: row.started_at ? row.started_at.toISOString() : null,
    finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
    updatedAt: row.updated_at.toISOString(),
  };
}

function toRawResult(row: RawDiscoveryResultRow) {
  return {
    id: row.id,
    searchId: row.search_id,
    tenantId: row.tenant_id,
    provider: row.provider,
    title: row.title,
    snippet: row.snippet,
    url: row.url,
    instagramUrl: row.instagram_url,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toInstagramProfile(row: InstagramProfileRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    leadId: row.lead_id,
    searchId: row.search_id,
    username: row.username,
    normalizedUsername: row.normalized_username,
    fullName: row.full_name,
    biography: row.biography,
    externalUrl: row.external_url,
    followers: row.followers,
    profilePicUrl: row.profile_pic_url,
    profileUrl: row.profile_url,
    source: row.source,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export const discoveryRepository = {
  async createSearch(tenantId: string, query: string, requestedMaxResults: number, provider: string): Promise<DiscoverySearchRecord> {
    const { rows } = await tenantQuery<DiscoverySearchRow>(
      tenantId,
      `INSERT INTO discovery_searches (id, tenant_id, query, status, provider, requested_max_results)
       VALUES ($1, $2, $3, 'queued', $4, $5)
       RETURNING *`,
      [uuid(), tenantId, query, provider, requestedMaxResults],
    );
    return toDiscoverySearch(rows[0]);
  },

  async getSearchById(tenantId: string, searchId: string): Promise<DiscoverySearchRecord | null> {
    const { rows } = await tenantQuery<DiscoverySearchRow>(
      tenantId,
      'SELECT * FROM discovery_searches WHERE id = $1 AND tenant_id = $2',
      [searchId, tenantId],
    );
    return rows[0] ? toDiscoverySearch(rows[0]) : null;
  },

  async markSearchRunning(tenantId: string, searchId: string): Promise<void> {
    await tenantQuery(
      tenantId,
      `UPDATE discovery_searches
          SET status = 'running',
              started_at = COALESCE(started_at, now()),
              updated_at = now()
        WHERE id = $1 AND tenant_id = $2`,
      [searchId, tenantId],
    );
  },

  async markSearchFailed(tenantId: string, searchId: string, errorMessage: string): Promise<void> {
    await tenantQuery(
      tenantId,
      `UPDATE discovery_searches
          SET status = 'failed',
              error_message = $3,
              finished_at = now(),
              updated_at = now()
        WHERE id = $1 AND tenant_id = $2`,
      [searchId, tenantId, errorMessage.slice(0, 600)],
    );
  },

  async markSearchCompletedIfFinished(tenantId: string, searchId: string): Promise<void> {
    const { rows } = await tenantQuery<{ pending_count: string }>(
      tenantId,
      `SELECT COUNT(*)::text AS pending_count
         FROM raw_discovery_results
        WHERE tenant_id = $1
          AND search_id = $2
          AND status IN ('queued', 'extracting', 'extracted', 'normalizing')`,
      [tenantId, searchId],
    );

    const pendingCount = Number(rows[0]?.pending_count || 0);
    if (pendingCount > 0) return;

    await tenantQuery(
      tenantId,
      `UPDATE discovery_searches
          SET status = CASE WHEN status = 'failed' THEN status ELSE 'completed' END,
              finished_at = COALESCE(finished_at, now()),
              updated_at = now()
        WHERE id = $1 AND tenant_id = $2`,
      [searchId, tenantId],
    );
  },

  async incrementSearchCounters(
    tenantId: string,
    searchId: string,
    delta: { discoveredUrls?: number; extractedProfiles?: number; normalizedLeads?: number; duplicates?: number },
  ): Promise<void> {
    await tenantQuery(
      tenantId,
      `UPDATE discovery_searches
          SET discovered_urls = discovered_urls + $3,
              extracted_profiles = extracted_profiles + $4,
              normalized_leads = normalized_leads + $5,
              duplicates = duplicates + $6,
              updated_at = now()
        WHERE id = $1 AND tenant_id = $2`,
      [
        searchId,
        tenantId,
        Math.max(0, Math.floor(delta.discoveredUrls || 0)),
        Math.max(0, Math.floor(delta.extractedProfiles || 0)),
        Math.max(0, Math.floor(delta.normalizedLeads || 0)),
        Math.max(0, Math.floor(delta.duplicates || 0)),
      ],
    );
  },

  async saveRawResults(tenantId: string, searchId: string, provider: string, candidates: GoogleSearchCandidate[]) {
    if (candidates.length === 0) return [];

    const values: unknown[] = [];
    const placeholders: string[] = [];
    let index = 1;

    for (const candidate of candidates) {
      placeholders.push(`($${index++}, $${index++}, $${index++}, $${index++}, $${index++}, $${index++}, $${index++}, 'queued')`);
      values.push(
        uuid(),
        searchId,
        tenantId,
        provider,
        candidate.title,
        candidate.snippet,
        candidate.url,
      );
    }

    const sql = `
      INSERT INTO raw_discovery_results (
        id, search_id, tenant_id, provider, title, snippet, url, status
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT (tenant_id, search_id, url) DO NOTHING
      RETURNING *
    `;

    const { rows } = await tenantQuery<RawDiscoveryResultRow>(tenantId, sql, values);

    if (rows.length > 0) {
      const linkValues: unknown[] = [];
      const linkPlaceholders: string[] = [];
      let linkIdx = 1;
      for (const row of rows) {
        const candidate = candidates.find((item) => item.url === row.url);
        if (!candidate?.instagramUrl) continue;
        linkPlaceholders.push(`($${linkIdx++}, $${linkIdx++}, $${linkIdx++})`);
        linkValues.push(row.id, tenantId, candidate.instagramUrl);
      }

      if (linkPlaceholders.length > 0) {
        await tenantQuery(
          tenantId,
          `UPDATE raw_discovery_results raw
              SET instagram_url = links.instagram_url,
                  updated_at = now()
             FROM (VALUES ${linkPlaceholders.join(', ')}) AS links(id, tenant_id, instagram_url)
            WHERE raw.id = links.id
              AND raw.tenant_id = links.tenant_id`,
          linkValues,
        );
      }
    }

    return rows.map(toRawResult);
  },

  async getRawResultById(tenantId: string, rawResultId: string) {
    const { rows } = await tenantQuery<RawDiscoveryResultRow>(
      tenantId,
      'SELECT * FROM raw_discovery_results WHERE id = $1 AND tenant_id = $2',
      [rawResultId, tenantId],
    );
    return rows[0] ? toRawResult(rows[0]) : null;
  },

  async setRawResultStatus(tenantId: string, rawResultId: string, status: string, errorMessage?: string): Promise<void> {
    await tenantQuery(
      tenantId,
      `UPDATE raw_discovery_results
          SET status = $3,
              error_message = $4,
              updated_at = now()
        WHERE id = $1 AND tenant_id = $2`,
      [rawResultId, tenantId, status, errorMessage ? errorMessage.slice(0, 600) : null],
    );
  },

  async upsertInstagramProfile(tenantId: string, searchId: string, profile: NormalizedLeadInput) {
    const { rows } = await tenantQuery<InstagramProfileRow & { inserted: boolean }>(
      tenantId,
      `INSERT INTO instagram_profiles (
         id,
         tenant_id,
         search_id,
         username,
         normalized_username,
         full_name,
         biography,
         external_url,
         followers,
         profile_pic_url,
         profile_url,
         source
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
       )
       ON CONFLICT (tenant_id, normalized_username)
       DO UPDATE SET
         search_id = EXCLUDED.search_id,
         username = EXCLUDED.username,
         full_name = EXCLUDED.full_name,
         biography = EXCLUDED.biography,
         external_url = EXCLUDED.external_url,
         followers = EXCLUDED.followers,
         profile_pic_url = EXCLUDED.profile_pic_url,
         profile_url = EXCLUDED.profile_url,
         source = EXCLUDED.source,
         updated_at = now()
       RETURNING *, (xmax = 0) AS inserted`,
      [
        uuid(),
        tenantId,
        searchId,
        profile.username,
        profile.normalizedUsername,
        profile.fullName,
        profile.biography,
        profile.externalUrl,
        profile.followers,
        profile.profilePicUrl,
        profile.profileUrl,
        profile.source,
      ],
    );

    const row = rows[0];
    return {
      ...toInstagramProfile(row),
      inserted: row.inserted,
    };
  },

  async findInstagramProfileByNormalizedUsername(tenantId: string, normalizedUsername: string) {
    const { rows } = await tenantQuery<InstagramProfileRow>(
      tenantId,
      'SELECT * FROM instagram_profiles WHERE tenant_id = $1 AND normalized_username = $2',
      [tenantId, normalizedUsername],
    );
    return rows[0] ? toInstagramProfile(rows[0]) : null;
  },

  async createLeadFromInstagramProfile(tenantId: string, searchQuery: string, profileId: string, input: NormalizedLeadInput): Promise<{ leadId: string; duplicate: boolean }> {
    return tenantTransaction(tenantId, async (client) => {
      const profileResult = await client.query<InstagramProfileRow>(
        'SELECT * FROM instagram_profiles WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
        [profileId, tenantId],
      );

      const profile = profileResult.rows[0];
      if (!profile) {
        throw new Error('Perfil de Instagram não encontrado para normalização');
      }

      if (profile.lead_id) {
        return { leadId: profile.lead_id, duplicate: true };
      }

      const leadId = uuid();
      const name = input.fullName || input.username;
      const website = input.externalUrl || input.profileUrl;

      const insertResult = await client.query<LeadRow>(
        `INSERT INTO leads (
           id,
           tenant_id,
           name,
           phone,
           website,
           website_fetch_error,
           email1,
           email2,
           city,
           neighborhood,
           address,
           has_website,
           rating,
           niche,
           priority,
           status,
           created_at
         ) VALUES (
           $1, $2, $3, '', $4, false, '', '', '', '', $5, $6, 0, $7, 'MEDIUM'::lead_priority, 'new'::lead_status, now()
         )
         ON CONFLICT (tenant_id, lower(name), lower(address)) DO NOTHING
         RETURNING *`,
        [leadId, tenantId, name, website, input.profileUrl, Boolean(input.externalUrl), searchQuery],
      );

      if (insertResult.rows.length === 0) {
        const existingLead = await client.query<{ id: string }>(
          `SELECT id FROM leads
            WHERE tenant_id = $1
              AND lower(name) = lower($2)
              AND lower(address) = lower($3)
            LIMIT 1`,
          [tenantId, name, input.profileUrl],
        );

        const duplicatedLeadId = existingLead.rows[0]?.id || leadId;
        await client.query(
          'UPDATE instagram_profiles SET lead_id = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3',
          [duplicatedLeadId, profileId, tenantId],
        );

        return { leadId: duplicatedLeadId, duplicate: true };
      }

      await client.query(
        'UPDATE instagram_profiles SET lead_id = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3',
        [leadId, profileId, tenantId],
      );

      return { leadId, duplicate: false };
    });
  },

  async getDiscoveryLeadsBySearchId(tenantId: string, searchId: string) {
    const { rows } = await tenantQuery<LeadRow>(
      tenantId,
      `SELECT l.*
         FROM instagram_profiles p
         JOIN leads l ON l.id = p.lead_id AND l.tenant_id = p.tenant_id
        WHERE p.tenant_id = $1
          AND p.search_id = $2
        ORDER BY l.created_at DESC`,
      [tenantId, searchId],
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      website: row.website,
      websiteFetchError: row.website_fetch_error,
      email1: row.email1,
      email2: row.email2,
      city: row.city,
      neighborhood: row.neighborhood,
      address: row.address,
      hasWebsite: row.has_website,
      rating: Number.parseFloat(row.rating) || 0,
      niche: row.niche,
      priority: row.priority as 'HIGH' | 'MEDIUM' | 'LOW',
      status: row.status as 'new' | 'contacted' | 'replied' | 'converted' | 'ignored',
      createdAt: row.created_at.toISOString(),
      link: row.address,
      platform: 'instagram',
      snippet: '',
    }));
  },
};
