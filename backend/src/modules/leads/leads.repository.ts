import { tenantQuery } from '../../db/pool';
import { Lead, LeadStatus } from '../../types/leads.types';

interface LeadRow {
  id: string;
  tenant_id: string;
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

function toLead(row: LeadRow): Lead {
  return {
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
    rating: parseFloat(row.rating) || 0,
    niche: row.niche,
    priority: row.priority as Lead['priority'],
    status: row.status as Lead['status'],
    createdAt: row.created_at.toISOString(),
  };
}

export const leadsRepository = {
  async getAll(tenantId: string): Promise<Lead[]> {
    const { rows } = await tenantQuery<LeadRow>(tenantId, 'SELECT * FROM leads ORDER BY created_at DESC');
    return rows.map(toLead);
  },

  async getById(tenantId: string, id: string): Promise<Lead | null> {
    const { rows } = await tenantQuery<LeadRow>(tenantId, 'SELECT * FROM leads WHERE id = $1', [id]);
    return rows[0] ? toLead(rows[0]) : null;
  },

  async getByNormalizedPhones(tenantId: string, phones: string[]): Promise<Map<string, Lead>> {
    const keySet = new Set<string>();
    for (const rawPhone of phones) {
      const digits = String(rawPhone || '').replace(/\D/g, '');
      if (!digits) continue;
      keySet.add(digits);
      if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
        keySet.add(`55${digits}`);
      }
      if (digits.startsWith('55') && digits.length > 11) {
        keySet.add(digits.slice(2));
      }
    }

    const keys = Array.from(keySet);
    if (keys.length === 0) return new Map();

    const { rows } = await tenantQuery<LeadRow>(
      tenantId,
      `SELECT *
         FROM leads
        WHERE regexp_replace(phone, '\\D', '', 'g') = ANY($1::text[])
        ORDER BY created_at DESC`,
      [keys],
    );

    const map = new Map<string, Lead>();
    for (const row of rows) {
      const lead = toLead(row);
      const digits = lead.phone.replace(/\D/g, '');
      const candidates = new Set<string>([digits]);
      if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
        candidates.add(`55${digits}`);
      }
      if (digits.startsWith('55') && digits.length > 11) {
        candidates.add(digits.slice(2));
      }

      for (const key of candidates) {
        if (key && !map.has(key)) {
          map.set(key, lead);
        }
      }
    }

    return map;
  },

  async saveMany(tenantId: string, newLeads: Lead[]): Promise<Lead[]> {
    if (newLeads.length === 0) return [];

    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const lead of newLeads) {
      placeholders.push(
        `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}::lead_priority, $${idx++}::lead_status, $${idx++})`,
      );
      values.push(
        lead.id, tenantId, lead.name, lead.phone, lead.website,
        lead.websiteFetchError, lead.email1, lead.email2, lead.city,
        lead.neighborhood, lead.address, lead.hasWebsite, lead.rating,
        lead.niche, lead.priority, lead.status, lead.createdAt,
      );
    }

    const sql = `
      INSERT INTO leads (id, tenant_id, name, phone, website, website_fetch_error, email1, email2, city, neighborhood, address, has_website, rating, niche, priority, status, created_at)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (tenant_id, lower(name), lower(address)) DO NOTHING
      RETURNING *
    `;

    const { rows } = await tenantQuery<LeadRow>(tenantId, sql, values);
    return rows.map(toLead);
  },

  async updateStatus(tenantId: string, id: string, status: LeadStatus): Promise<Lead | null> {
    const { rows } = await tenantQuery<LeadRow>(
      tenantId,
      'UPDATE leads SET status = $1::lead_status WHERE id = $2 RETURNING *',
      [status, id],
    );
    return rows[0] ? toLead(rows[0]) : null;
  },

  async delete(tenantId: string, id: string): Promise<boolean> {
    const { rowCount } = await tenantQuery(tenantId, 'DELETE FROM leads WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },
};
