import { tenantQuery } from '../db/pool';
import { Quote } from '../types/quote.types';

interface QuoteRow {
  id: string;
  tenant_id: string;
  client: Quote['client'];
  project: Quote['project'];
  services: Quote['services'];
  extras: Quote['extras'];
  payment: Quote['payment'];
  subtotal_services: string;
  subtotal_extras: string;
  total: string;
  created_at: Date;
  valid_until: Date;
}

function toQuote(row: QuoteRow): Quote {
  return {
    id: row.id,
    client: row.client,
    project: row.project,
    services: row.services,
    extras: row.extras,
    payment: row.payment,
    subtotalServices: parseFloat(row.subtotal_services) || 0,
    subtotalExtras: parseFloat(row.subtotal_extras) || 0,
    total: parseFloat(row.total) || 0,
    createdAt: row.created_at.toISOString(),
    validUntil: row.valid_until.toISOString(),
  };
}

export const storageService = {
  async getAll(tenantId: string): Promise<Quote[]> {
    const { rows } = await tenantQuery<QuoteRow>(tenantId, 'SELECT * FROM quotes ORDER BY created_at DESC');
    return rows.map(toQuote);
  },

  async getById(tenantId: string, id: string): Promise<Quote | null> {
    const { rows } = await tenantQuery<QuoteRow>(tenantId, 'SELECT * FROM quotes WHERE id = $1', [id]);
    return rows[0] ? toQuote(rows[0]) : null;
  },

  async save(tenantId: string, quote: Quote): Promise<void> {
    await tenantQuery(
      tenantId,
      `INSERT INTO quotes (id, tenant_id, client, project, services, extras, payment, subtotal_services, subtotal_extras, total, created_at, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         client = EXCLUDED.client,
         project = EXCLUDED.project,
         services = EXCLUDED.services,
         extras = EXCLUDED.extras,
         payment = EXCLUDED.payment,
         subtotal_services = EXCLUDED.subtotal_services,
         subtotal_extras = EXCLUDED.subtotal_extras,
         total = EXCLUDED.total`,
      [
        quote.id, tenantId,
        JSON.stringify(quote.client), JSON.stringify(quote.project),
        JSON.stringify(quote.services), JSON.stringify(quote.extras),
        JSON.stringify(quote.payment),
        quote.subtotalServices, quote.subtotalExtras, quote.total,
        quote.createdAt, quote.validUntil,
      ],
    );
  },
};
