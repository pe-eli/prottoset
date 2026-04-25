import { query } from '../../db/pool';

export type WebhookProvider = 'mercadopago' | 'evolution';
export type WebhookEventStatus = 'pending' | 'processed' | 'failed';

interface WebhookEventRow {
  id: string;
  provider: WebhookProvider;
  event_id: string;
  event_type: string | null;
  status: WebhookEventStatus;
  payload: Record<string, unknown>;
  signature_valid: boolean;
  received_at: Date;
  processed_at: Date | null;
  failure_reason: string | null;
}

export interface WebhookEvent {
  id: string;
  provider: WebhookProvider;
  eventId: string;
  eventType: string | null;
  status: WebhookEventStatus;
  payload: Record<string, unknown>;
  signatureValid: boolean;
  receivedAt: string;
  processedAt: string | null;
  failureReason: string | null;
}

function mapWebhookEvent(row: WebhookEventRow): WebhookEvent {
  return {
    id: row.id,
    provider: row.provider,
    eventId: row.event_id,
    eventType: row.event_type,
    status: row.status,
    payload: row.payload,
    signatureValid: row.signature_valid,
    receivedAt: row.received_at.toISOString(),
    processedAt: row.processed_at ? row.processed_at.toISOString() : null,
    failureReason: row.failure_reason,
  };
}

export const webhookEventsRepository = {
  async createPending(params: {
    provider: WebhookProvider;
    eventId: string;
    eventType?: string;
    payload: Record<string, unknown>;
    signatureValid: boolean;
  }): Promise<{ created: boolean; event: WebhookEvent }> {
    const { rows } = await query<WebhookEventRow>(
      `INSERT INTO webhook_events (provider, event_id, event_type, status, payload, signature_valid)
       VALUES ($1, $2, $3, 'pending', $4::jsonb, $5)
       ON CONFLICT (provider, event_id) DO NOTHING
       RETURNING *`,
      [
        params.provider,
        params.eventId,
        params.eventType ?? null,
        JSON.stringify(params.payload),
        params.signatureValid,
      ],
    );

    if (rows[0]) {
      return { created: true, event: mapWebhookEvent(rows[0]) };
    }

    const existing = await this.findByProviderAndEventId(params.provider, params.eventId);
    if (!existing) {
      throw new Error('Falha ao recuperar evento de webhook existente');
    }
    return { created: false, event: existing };
  },

  async findById(id: string): Promise<WebhookEvent | null> {
    const { rows } = await query<WebhookEventRow>('SELECT * FROM webhook_events WHERE id = $1 LIMIT 1', [id]);
    return rows[0] ? mapWebhookEvent(rows[0]) : null;
  },

  async findByProviderAndEventId(provider: WebhookProvider, eventId: string): Promise<WebhookEvent | null> {
    const { rows } = await query<WebhookEventRow>(
      'SELECT * FROM webhook_events WHERE provider = $1 AND event_id = $2 LIMIT 1',
      [provider, eventId],
    );
    return rows[0] ? mapWebhookEvent(rows[0]) : null;
  },

  async markProcessed(id: string): Promise<void> {
    await query(
      `INSERT INTO processed_webhooks (provider, event_id)
       SELECT provider, event_id
       FROM webhook_events
       WHERE id = $1
       ON CONFLICT (provider, event_id) DO NOTHING`,
      [id],
    );

    await query(
      `UPDATE webhook_events
       SET status = 'processed',
           processed_at = now(),
           failure_reason = NULL
       WHERE id = $1`,
      [id],
    );
  },

  async isAlreadyProcessed(provider: WebhookProvider, eventId: string): Promise<boolean> {
    const { rowCount } = await query(
      `SELECT 1
       FROM processed_webhooks
       WHERE provider = $1 AND event_id = $2
       LIMIT 1`,
      [provider, eventId],
    );

    return (rowCount ?? 0) > 0;
  },

  async markFailed(id: string, reason: string): Promise<void> {
    await query(
      `UPDATE webhook_events
       SET status = 'failed',
           processed_at = now(),
           failure_reason = $2
       WHERE id = $1`,
      [id, reason.slice(0, 1200)],
    );
  },

  async reserveNonce(provider: WebhookProvider, nonce: string, ttlSeconds: number): Promise<boolean> {
    const { rowCount } = await query(
      `INSERT INTO webhook_nonces (provider, nonce, expires_at)
       VALUES ($1, $2, now() + make_interval(secs => $3::int))
       ON CONFLICT (provider, nonce) DO NOTHING`,
      [provider, nonce, ttlSeconds],
    );
    return (rowCount ?? 0) > 0;
  },

  async cleanupExpiredNonces(): Promise<void> {
    await query('DELETE FROM webhook_nonces WHERE expires_at < now()');
  },
};
