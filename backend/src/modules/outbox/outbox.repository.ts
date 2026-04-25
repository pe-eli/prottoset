import type { PoolClient } from 'pg';
import { query } from '../../db/pool';

interface OutboxRow {
  id: string;
  tenant_id: string;
  topic: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'dispatched' | 'failed';
  attempts: number;
  last_error: string | null;
  available_at: Date;
  created_at: Date;
  dispatched_at: Date | null;
}

export interface OutboxEvent {
  id: string;
  tenantId: string;
  topic: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'dispatched' | 'failed';
  attempts: number;
  lastError: string | null;
  availableAt: string;
  createdAt: string;
  dispatchedAt: string | null;
}

function mapOutbox(row: OutboxRow): OutboxEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    topic: row.topic,
    payload: row.payload ?? {},
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    availableAt: row.available_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    dispatchedAt: row.dispatched_at ? row.dispatched_at.toISOString() : null,
  };
}

export const outboxRepository = {
  async enqueueInTransaction(client: PoolClient, input: {
    tenantId: string;
    topic: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await client.query(
      `INSERT INTO outbox_events (tenant_id, topic, payload, status)
       VALUES ($1, $2, $3::jsonb, 'pending')`,
      [input.tenantId, input.topic, JSON.stringify(input.payload)],
    );
  },

  async claimPending(limit: number): Promise<OutboxEvent[]> {
    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit || 20)));

    const { rows } = await query<OutboxRow>(
      `WITH claimed AS (
         SELECT id
         FROM outbox_events
         WHERE status IN ('pending', 'failed')
           AND available_at <= now()
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE outbox_events o
       SET attempts = o.attempts + 1,
           last_error = NULL
       FROM claimed
       WHERE o.id = claimed.id
       RETURNING o.*`,
      [safeLimit],
    );

    return rows.map(mapOutbox);
  },

  async markDispatched(id: string): Promise<void> {
    await query(
      `UPDATE outbox_events
       SET status = 'dispatched',
           dispatched_at = now(),
           last_error = NULL
       WHERE id = $1`,
      [id],
    );
  },

  async markFailed(id: string, error: string, retryInSeconds = 30): Promise<void> {
    await query(
      `UPDATE outbox_events
       SET status = 'failed',
           last_error = $2,
           available_at = now() + make_interval(secs => $3::int)
       WHERE id = $1`,
      [id, error.slice(0, 1200), Math.max(5, Math.floor(retryInSeconds))],
    );
  },
};
